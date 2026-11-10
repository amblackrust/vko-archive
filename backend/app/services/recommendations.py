"""«Similar materials» (T4.12): public objects nearest to a public object by the
embeddings of their descriptions (bge-m3 vectors of the search index).

- The source object must be public (else 404, as its card); every recommended object is
  re-checked against the live object (`indexing.INDEXED_TYPES[...].is_public`), so a
  stale index row never shows a hidden object.
- Personal mode: the visitor's recently viewed documents (`seen`, stored only in their
  browser) are mixed into the query vector and excluded from the result. Unknown or
  non-public ids in `seen` are ignored. Nothing about the visitor is stored or logged.
- Without vectors (Ollama was down while indexing): documents — shared published tags,
  then the same fund; other types — public objects with words of the title (FTS).
"""

import math
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.ai import rag
from app.models import Document
from app.repositories import catalog as catalog_repo
from app.repositories import recommendations as repo
from app.repositories import search as search_repo
from app.schemas.recommendations import RecommendationItem, RecommendationParams, RecommendationsResponse
from app.services import search as search_service
from app.services.errors import NotFound
from app.services.indexing import INDEXED_TYPES, strip_html

MAX_DISTANCE = 0.6
SUMMARY_CHARS = 200
SOURCE_WEIGHT = 2.0  # the current object outweighs the whole personal history

# Plain-text summary shown under the title.
_SUMMARY_FIELDS = {
    "document": "summary", "fund": "annotation", "exhibition": "intro", "collection": "description",
    "news": "summary", "page": "seo_description", "branch": "description",
}

Key = tuple[str, uuid.UUID]


def _pick(value: dict[str, str] | None, lang: str) -> tuple[str, str]:
    for candidate in (lang, "ru", "kk", "en"):
        text = ((value or {}).get(candidate) or "").strip()
        if text:
            return text, candidate
    return "", lang


def _unit(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    return [x / norm for x in vector] if norm else vector


def _mean(vectors: list[list[float]]) -> list[float]:
    return [sum(column) / len(vectors) for column in zip(*vectors, strict=True)]


def query_vector(source: list[list[float]], history: list[list[list[float]]]) -> list[float] | None:
    """Unit mean of the source rows (weight SOURCE_WEIGHT) and of each viewed object
    (together weight 1). None if the source has no vectors."""
    if not source:
        return None
    parts = [[x * SOURCE_WEIGHT for x in _unit(_mean(source))]]
    for rows in history:
        parts.append([x / len(history) for x in _unit(_mean(rows))])
    return _unit([sum(column) for column in zip(*parts, strict=True)])


def _load_public(session: Session, keys: list[Key]) -> dict[Key, Any]:
    by_type: dict[str, set[uuid.UUID]] = defaultdict(set)
    for object_type, object_id in keys:
        by_type[object_type].add(object_id)
    found: dict[Key, Any] = {}
    for object_type, ids in by_type.items():
        spec = INDEXED_TYPES.get(object_type)
        if spec is None:
            continue
        for obj in search_repo.load_objects(session, spec.model, ids):
            if spec.is_public(obj):
                found[(object_type, obj.id)] = obj
    return found


def _item(object_type: str, obj: Any, lang: str) -> RecommendationItem:
    title, title_lang = _pick(getattr(obj, "title", None) or getattr(obj, "name", None), lang)
    summary = _pick(getattr(obj, _SUMMARY_FIELDS.get(object_type, ""), None), lang)[0]
    return RecommendationItem(
        type=object_type,
        id=obj.id,
        title=title,
        title_lang=title_lang,
        href=search_service._href(object_type, obj),
        summary=rag.shorten(strip_html(summary), SUMMARY_CHARS),
        document=search_service._document_meta(obj) if object_type == "document" else None,
    )


def similar_keys(
    session: Session, source: Key, types: list[str], seen: list[uuid.UUID], limit: int
) -> tuple[list[Key], bool]:
    """Public objects similar to `source` (assumed public), best first, by embeddings only.
    Returns (keys, personal) — personal: some viewed document was used. Empty without vectors."""
    seen_ids = [i for i in dict.fromkeys(seen) if i != source[1]]
    seen_public = list(_load_public(session, [("document", i) for i in seen_ids]))
    vectors = repo.description_vectors(session, [source, *seen_public])
    history = [vectors[key] for key in seen_public if key in vectors]
    vector = query_vector(vectors.get(source, []), history)
    if vector is None:
        return [], False
    exclude = {source[1], *seen_ids}
    candidates = repo.nearest_objects(session, vector, types, exclude, MAX_DISTANCE, limit * 2)
    public = _load_public(session, [(t, i) for t, i, _ in candidates])
    return [(t, i) for t, i, _ in candidates if (t, i) in public][:limit], bool(history)


def _fallback_keys(session: Session, source: Key, obj: Any, types: list[str], exclude: set[uuid.UUID], limit: int) -> list[Key]:
    if source[0] == "document" and types == ["document"]:
        tags = [tag.id for tag in catalog_repo.published_tags(session, obj.id)]
        ids = repo.fallback_documents(session, tags, repo.document_fund_id(session, obj), exclude, limit)
        return [("document", i) for i in ids]
    title = _pick(getattr(obj, "title", None) or getattr(obj, "name", None), "ru")[0]
    plan = search_service.build_query(title, [])
    if not plan.or_query:
        return []
    rows = search_repo.fts_candidates(session, plan.or_query, limit * 4)
    keys = list(dict.fromkeys((t, i) for t, i, file_id, _ in rows if file_id is None and t in types and i not in exclude))
    public = _load_public(session, keys)
    return [key for key in keys if key in public][:limit]


def recommend(session: Session, params: RecommendationParams) -> RecommendationsResponse:
    source: Key = (params.type, params.id)
    obj = _load_public(session, [source]).get(source)
    if obj is None:
        raise NotFound()
    types = list(dict.fromkeys(params.types)) or [params.type]
    keys, personal = similar_keys(session, source, types, params.seen, params.limit)
    method = "vector" if keys else "fallback"
    if len(keys) < params.limit:
        exclude = {params.id, *params.seen, *(i for _, i in keys)}
        keys += _fallback_keys(session, source, obj, types, exclude, params.limit - len(keys))
    objects = _load_public(session, keys)
    items = [_item(t, objects[(t, i)], params.lang) for t, i in keys if (t, i) in objects]
    return RecommendationsResponse(method=method, personal=personal, items=items)


def similar_document_ids(session: Session, document: Document, limit: int) -> list[uuid.UUID]:
    """For the document card (`related`): public documents nearest by embeddings."""
    keys, _ = similar_keys(session, ("document", document.id), ["document"], [], limit)
    return [object_id for _, object_id in keys]
