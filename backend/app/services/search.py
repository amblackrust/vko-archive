"""Unified hybrid search (T3.2): FTS + trigram + vector, merged with Reciprocal Rank Fusion.

- FTS: `simple` tsvector; query lexemes get a prefix match (`:*`, long words are trimmed by
  two letters — a cheap stand-in for the missing Russian/Kazakh stemmer), synonym groups
  are expanded into OR-alternatives. All words must match (AND); if nothing matches,
  any word may match (OR).
- Trigram: word similarity of the whole query to titles (typos, spelling variants).
- Vector: bge-m3 query embedding vs entry vectors (cosine). If Ollama is unavailable the
  vector list is simply empty — search degrades to FTS + trigram.

Only what the indexer wrote can be found, and every hit is re-checked against the live
object (`indexing.INDEXED_TYPES[...].is_public`) before it is counted, grouped, faceted
or shown, so a stale row can never expose a hidden object. OCR chunks are re-checked too:
a chunk is used (for matching and snippets) only while its source file is still
downloadable by an anonymous visitor. Snippets come from indexed (public) text only and
are HTML-escaped; highlights are <mark> tags. `title` is plain text.

Search deliberately ignores the current user: staff get the same public results as
visitors (docs/DECISIONS.md).
"""

import html
import re
import uuid
from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.ai.embeddings import embed_query
from app.config import Settings
from app.models import Branch, Document
from app.models.enums import WorkflowStatus
from app.repositories import search as search_repo
from app.schemas.search import (
    DocumentMeta,
    FacetValue,
    SearchFacets,
    SearchFilters,
    SearchGroup,
    SearchItem,
    SearchResponse,
)
from app.services import files as files_service
from app.services import search_log
from app.services.authz import FILE_DOWNLOAD, authorize
from app.services.indexing import INDEXED_TYPES, OCR_LANG

TYPE_ORDER = ("document", "fund", "page", "branch", "exhibition", "collection", "news")
MAX_QUERY_CHARS = 200
MAX_TOKENS = 12
CANDIDATES_PER_METHOD = 200
RRF_K = 60
# Cosine distance cutoff for vector hits (bge-m3); without it every query would "match"
# its nearest neighbours. Tuned on the demo catalog, see docs/DECISIONS.md.
VECTOR_MAX_DISTANCE = 0.5
# A query must stay fast: a slow Ollama just means no vector hits (indexing has its own timeout).
QUERY_EMBED_TIMEOUT_SECONDS = 2.0
SNIPPET_FALLBACK_CHARS = 220

_WORD_RE = re.compile(r"\w+")
_STOPWORDS = frozenset(
    "и в во на о об по с со к ко из за для от до у а но или не что как это the of and in on for to a an "
    "мен және бен пен мен да де туралы".split()
)

# Public site paths (without the locale prefix) are built here, never by a model.
_PAGE_PATHS = {
    "history": "/about/history",
    "structure": "/about/structure",
    "contacts": "/contacts",
    "compliance": "/compliance",
}


def _href(object_type: str, obj: Any) -> str:
    ref = getattr(obj, "slug", None) or str(obj.id)
    if object_type == "document":
        return f"/catalog/documents/{obj.id}"
    if object_type == "fund":
        return f"/catalog/funds/{obj.id}"
    if object_type == "page":
        return _PAGE_PATHS.get(obj.key, f"/pages/{obj.key}")
    if object_type == "branch":
        return f"/branches/{ref}"
    if object_type == "exhibition":
        return f"/exhibitions/{ref}"
    if object_type == "collection":
        return f"/memory/collections/{ref}"
    return f"/news/{ref}"


# --- query building -----------------------------------------------------------------


def tokenize(text: str) -> list[str]:
    return [t for t in _WORD_RE.findall(text.lower()) if t != "_"]


def _lexeme(token: str) -> str:
    """tsquery operand for one token (tokens are \\w only, so quoting is safe)."""
    if token.isdigit() or len(token) < 4:
        return f"'{token}'"
    stem = token if len(token) < 6 else token[: max(5, len(token) - 2)]
    return f"'{stem}':*"


def _phrase(tokens: list[str]) -> str:
    return " <-> ".join(_lexeme(t) for t in tokens)


@dataclass
class QueryPlan:
    text: str
    and_query: str | None
    or_query: str | None
    expanded: list[str] = field(default_factory=list)  # synonym terms added to the query


def build_query(text: str, synonym_groups: list[list[str]]) -> QueryPlan:
    """Clauses = query words; a word (or several) that is a synonym term becomes
    (term | other terms of its group)."""
    tokens = tokenize(text)[:MAX_TOKENS]
    content = [t for t in tokens if t not in _STOPWORDS] or tokens
    groups = [[tokenize(term) for term in group] for group in synonym_groups]
    groups = [[term for term in group if term] for group in groups]
    clauses: list[str] = []
    expanded: list[str] = []
    i = 0
    while i < len(content):
        match: tuple[int, list[list[str]]] | None = None
        for group in groups:
            for term in group:
                n = len(term)
                if content[i : i + n] == term and (match is None or n > match[0]):
                    match = (n, group)
        if match is None:
            clauses.append(_lexeme(content[i]))
            i += 1
            continue
        n, group = match
        alternatives = sorted({_phrase(term) for term in group})
        clauses.append("(" + " | ".join(f"({a})" for a in alternatives) + ")")
        expanded.extend(" ".join(term) for term in group if term != content[i : i + n])
        i += n
    if not clauses:
        return QueryPlan(text=text, and_query=None, or_query=None)
    return QueryPlan(
        text=text,
        and_query=" & ".join(clauses),
        or_query=" | ".join(clauses) if len(clauses) > 1 else None,
        expanded=expanded,
    )


# --- fusion -------------------------------------------------------------------------

Key = tuple[str, uuid.UUID]


@dataclass
class Hit:
    key: Key
    score: float = 0.0
    matched: list[str] = field(default_factory=list)


def _downloadable_files(session: Session, file_ids: set[uuid.UUID]) -> dict[uuid.UUID, Key]:
    """file_id -> owner key for the files an anonymous visitor may download right now
    (the live rule, authz "file.download"); others are left out."""
    allowed: dict[uuid.UUID, Key] = {}
    for file in search_repo.load_files(session, file_ids):
        if file.owner_type in INDEXED_TYPES and file.owner_id is not None and authorize(
            None, FILE_DOWNLOAD, files_service.file_target(session, file)
        ):
            allowed[file.id] = (file.owner_type, file.owner_id)
    return allowed


class _OcrGuard:
    """Decides whether an index row may be used: description rows (no file) always,
    OCR chunks only while their file is downloadable and belongs to the row's object."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._allowed: dict[uuid.UUID, Key] = {}
        self._checked: set[uuid.UUID] = set()

    def check(self, file_ids: set[uuid.UUID | None]) -> None:
        new = {f for f in file_ids if f is not None} - self._checked
        if new:
            self._allowed.update(_downloadable_files(self._session, new))
            self._checked |= new

    def ok(self, object_type: str, object_id: uuid.UUID, file_id: uuid.UUID | None) -> bool:
        return file_id is None or self._allowed.get(file_id) == (object_type, object_id)


def _live_candidates(guard: _OcrGuard, rows: list[search_repo.Candidate]) -> list[tuple[str, uuid.UUID, float]]:
    """Drops rows of files no longer downloadable; keeps the best remaining row per object
    (rows come ordered best first)."""
    guard.check({file_id for _, _, file_id, _ in rows})
    seen: set[Key] = set()
    result: list[tuple[str, uuid.UUID, float]] = []
    for object_type, object_id, file_id, score in rows:
        if (object_type, object_id) in seen or not guard.ok(object_type, object_id, file_id):
            continue
        seen.add((object_type, object_id))
        result.append((object_type, object_id, score))
    return result


def fuse(ranked_lists: dict[str, list[tuple[str, uuid.UUID, float]]]) -> dict[Key, Hit]:
    """Reciprocal Rank Fusion: score = Σ 1 / (k + rank) over the methods that found it."""
    hits: dict[Key, Hit] = {}
    for method, rows in ranked_lists.items():
        for rank, (object_type, object_id, _) in enumerate(rows, start=1):
            hit = hits.setdefault((object_type, object_id), Hit((object_type, object_id)))
            hit.score += 1.0 / (RRF_K + rank)
            hit.matched.append(method)
    return hits


# --- results ------------------------------------------------------------------------


def _snippet_html(text: str) -> str:
    escaped = html.escape(text, quote=False)
    return escaped.replace(search_repo.HL_START, "<mark>").replace(search_repo.HL_STOP, "</mark>")


def _pick_rows(rows: list[Any], lang: str) -> tuple[Any | None, str | None]:
    """Display row (main chunk in the requested language, else ru/kk/en) and the best
    highlighted snippet (display row first, then other rows, e.g. OCR chunks)."""
    main = [r for r in rows if r.chunk_no == 0 and r.lang != OCR_LANG]
    order = [lang] + [lng for lng in ("ru", "kk", "en") if lng != lang]
    display = next((r for lng in order for r in main if r.lang == lng), main[0] if main else None)
    if display is None:
        return None, None
    for row in [display] + [r for r in rows if r is not display]:
        if row.headline and search_repo.HL_START in row.headline:
            return display, _snippet_html(row.headline)
    if display.headline:
        return display, _snippet_html(display.headline)
    body = display.body
    if len(body) > SNIPPET_FALLBACK_CHARS:
        body = body[:SNIPPET_FALLBACK_CHARS].rsplit(" ", 1)[0] + " …"
    return display, html.escape(body, quote=False)


def _i18n(value: dict[str, str] | None, lang: str) -> str:
    value = value or {}
    for lng in (lang, "ru", "kk", "en"):
        if value.get(lng):
            return value[lng]
    return ""


@dataclass
class _Result:
    hit: Hit
    obj: Any

    @property
    def object_type(self) -> str:
        return self.hit.key[0]


def _document_value(dimension: str) -> Callable[[_Result], str | None]:
    def value(result: _Result) -> str | None:
        if result.object_type != "document":
            return None
        raw = getattr(result.obj, dimension)
        return str(raw) if raw is not None else None

    return value


_DIMENSIONS: dict[str, Callable[[_Result], str | None]] = {
    "type": lambda r: r.object_type,
    "doc_type": _document_value("doc_type"),
    "period": _document_value("period"),
    "branch": _document_value("branch_id"),
}


def _filter_values(filters: SearchFilters) -> dict[str, set[str]]:
    return {
        "type": set(filters.types),
        "doc_type": set(filters.doc_type),
        "period": set(filters.period),
        "branch": {str(b) for b in filters.branch_id},
    }


def _passes(result: _Result, active: dict[str, set[str]], skip: str | None = None) -> bool:
    for dimension, wanted in active.items():
        if not wanted or dimension == skip:
            continue
        if dimension != "type" and result.object_type != "document":
            # Document-only filters hide everything that is not a document.
            return False
        if _DIMENSIONS[dimension](result) not in wanted:
            return False
    return True


def _facets(session: Session, results: list[_Result], active: dict[str, set[str]], lang: str) -> SearchFacets:
    """Disjunctive facets: each dimension is counted with all *other* filters applied,
    so the UI can offer alternatives to the selected value."""
    counts: dict[str, Counter[str]] = {}
    for dimension, value_of in _DIMENSIONS.items():
        counter: Counter[str] = Counter()
        for result in results:
            if _passes(result, active, skip=dimension):
                value = value_of(result)
                if value is not None:
                    counter[value] += 1
        counts[dimension] = counter
    # Labels only for published branches: an unpublished one stays an id without a name.
    branch_names = {
        str(b.id): _i18n(b.short_name, lang) or _i18n(b.name, lang)
        for b in search_repo.load_objects(session, Branch, {uuid.UUID(v) for v in counts["branch"]})
        if b.workflow_status == WorkflowStatus.PUBLISHED
    }

    def values(dimension: str, labels: dict[str, str] | None = None) -> list[FacetValue]:
        items = counts[dimension].items()
        if dimension == "type":
            ordered = sorted(items, key=lambda kv: TYPE_ORDER.index(kv[0]))
        else:
            ordered = sorted(items, key=lambda kv: (-kv[1], kv[0]))
        return [FacetValue(value=v, label=(labels or {}).get(v), count=c) for v, c in ordered]

    return SearchFacets(
        type=values("type"),
        doc_type=values("doc_type"),
        period=values("period"),
        branch=values("branch", branch_names),
    )


def _load_public(session: Session, hits: dict[Key, Hit]) -> list[_Result]:
    by_type: dict[str, set[uuid.UUID]] = defaultdict(set)
    for object_type, object_id in hits:
        by_type[object_type].add(object_id)
    results: list[_Result] = []
    for object_type, ids in by_type.items():
        spec = INDEXED_TYPES.get(object_type)
        if spec is None:
            continue
        for obj in search_repo.load_objects(session, spec.model, ids):
            if spec.is_public(obj):
                results.append(_Result(hits[(object_type, obj.id)], obj))
    results.sort(key=lambda r: (-r.hit.score, TYPE_ORDER.index(r.object_type), str(r.obj.id)))
    return results


def _document_meta(document: Document) -> DocumentMeta:
    return DocumentMeta(
        archive_code=document.archive_code,
        date_text=document.date_text,
        doc_type=document.doc_type,
        period=document.period,
        branch_id=document.branch_id,
        file_access=document.file_access.value,
        has_digital_copy=document.has_digital_copy,
    )


def search(session: Session, settings: Settings, filters: SearchFilters) -> SearchResponse:
    text = " ".join(filters.q.split())[:MAX_QUERY_CHARS]
    plan = build_query(text, search_repo.active_synonym_groups(session))
    empty = SearchResponse(query=text, lang=filters.lang, total=0, groups=[], facets=SearchFacets(), semantic=False)
    if plan.and_query is None:
        return empty

    guard = _OcrGuard(session)
    ranked: dict[str, list[tuple[str, uuid.UUID, float]]] = {}
    fts_query = plan.and_query
    ranked["fts"] = _live_candidates(guard, search_repo.fts_candidates(session, fts_query, CANDIDATES_PER_METHOD))
    if not ranked["fts"] and plan.or_query:
        fts_query = plan.or_query
        ranked["fts"] = _live_candidates(guard, search_repo.fts_candidates(session, fts_query, CANDIDATES_PER_METHOD))
    if len(text) >= 3:
        ranked["trigram"] = _live_candidates(
            guard, search_repo.trigram_candidates(session, text, CANDIDATES_PER_METHOD)
        )
    vector = embed_query(text, settings, timeout=QUERY_EMBED_TIMEOUT_SECONDS)
    if vector is not None:
        ranked["vector"] = _live_candidates(
            guard, search_repo.vector_candidates(session, vector, VECTOR_MAX_DISTANCE, CANDIDATES_PER_METHOD)
        )

    results = _load_public(session, fuse(ranked))
    active = _filter_values(filters)
    facets = _facets(session, results, active, filters.lang)
    selected = [r for r in results if _passes(r, active)]

    by_type: dict[str, list[_Result]] = defaultdict(list)
    for result in selected:
        by_type[result.object_type].append(result)
    page = {
        object_type: items[filters.offset : filters.offset + filters.per_group]
        for object_type, items in by_type.items()
    }
    shown_keys = [r.hit.key for items in page.values() for r in items]
    rows_by_key: dict[Key, list[Any]] = defaultdict(list)
    shown_rows = search_repo.entries_for(session, shown_keys, fts_query)
    guard.check({row.file_id for row in shown_rows})
    for row in shown_rows:
        if guard.ok(row.object_type, row.object_id, row.file_id):
            rows_by_key[(row.object_type, row.object_id)].append(row)

    groups: list[SearchGroup] = []
    for object_type in TYPE_ORDER:
        if object_type not in by_type:
            continue
        items: list[SearchItem] = []
        for result in page[object_type]:
            display, snippet = _pick_rows(rows_by_key[result.hit.key], filters.lang)
            if display is None:
                continue
            items.append(
                SearchItem(
                    type=object_type,
                    id=result.obj.id,
                    title=display.title,
                    lang=display.lang,
                    snippet=snippet or "",
                    href=_href(object_type, result.obj),
                    score=round(result.hit.score, 6),
                    matched=result.hit.matched,
                    document=_document_meta(result.obj) if object_type == "document" else None,
                )
            )
        groups.append(SearchGroup(type=object_type, total=len(by_type[object_type]), items=items))

    if filters.log and filters.offset == 0:
        search_log.log_search(session, query=text, lang=filters.lang, source="search", results_count=len(selected))
    return SearchResponse(
        query=text,
        lang=filters.lang,
        total=len(selected),
        groups=groups,
        facets=facets,
        semantic=vector is not None,
        expanded=plan.expanded,
    )
