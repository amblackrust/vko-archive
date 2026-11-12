"""Search indexing (T3.1): keeps `search_entries` in sync with public content.

Only public content is indexed: documents that are published AND description_status =
public; other types when published. OCR text is indexed only for files an anonymous
visitor may download (authorize(None, "file.download", ...)), so text of closed,
restricted or unreviewed files never reaches the index.

Sync part (same transaction as the change): `reindex_object()` deletes the object's
rows and, if it is still public, writes new rows with tsvector (FTS) and title (trigram).
`workflow.save_with_version` calls it on every save/transition, so unpublishing or
do_not_publish removes the rows before the commit. A document's text includes the titles
of its fund and case (only while they are published) and of its published tags, so saving
a fund/inventory/case re-indexes its documents too (`reindex_documents_under`). Vectors are filled afterwards by
`embed_pending()` (a BackgroundTask after workflow transitions, or the command below);
unchanged texts keep their vectors. Only one embed_pending runs at a time (advisory lock),
and no transaction stays open while Ollama computes vectors.

Command: `python -m app.services.indexing [--no-embed]` — default synonyms (if the
table is empty), full reindex, then embeddings for rows without a vector.
"""

import argparse
import html
import logging
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.ai.embeddings import EmbeddingUnavailable, embed_texts
from app.config import Settings, get_settings
from app.models import Branch, Collection, Document, Exhibition, Fund, News, Page
from app.models.enums import DescriptionStatus, WorkflowStatus
from app.repositories import files as files_repo
from app.repositories import search as search_repo
from app.services.authz import FILE_DOWNLOAD, FileTarget, authorize

logger = logging.getLogger(__name__)

LANGS = ("kk", "ru", "en")
# Language code of OCR chunks: the text language of a scan is not known.
OCR_LANG = "und"
OCR_CHUNK_CHARS = 1200
EMBED_TEXT_CHARS = 4000
EMBED_BATCH = 8
# Indexing is offline work: a slow (CPU/shared GPU) Ollama gets more time than queries.
EMBED_TIMEOUT_SECONDS = 180.0
# A BackgroundTask after one admin action embeds at most this many rows; the indexing
# command picks up the rest.
EMBED_BACKGROUND_MAX_ROWS = 200
# pg advisory lock key for embed_pending ("embd"): concurrent runs would embed the same rows.
EMBED_LOCK_KEY = 0x656D6264

# Words for document types, so a query like "фото" or "приказ" finds them by type too.
DOC_TYPE_LABELS: dict[str, dict[str, str]] = {
    "order": {"ru": "приказ", "kk": "бұйрық", "en": "order"},
    "protocol": {"ru": "протокол", "kk": "хаттама", "en": "protocol"},
    "decision": {"ru": "решение", "kk": "шешім", "en": "decision"},
    "photo": {"ru": "фотография", "kk": "фотосурет", "en": "photograph"},
    "drawing": {"ru": "чертёж", "kk": "сызба", "en": "drawing"},
    "map": {"ru": "карта", "kk": "карта", "en": "map"},
    "letter": {"ru": "письмо", "kk": "хат", "en": "letter"},
    "newspaper": {"ru": "газета", "kk": "газет", "en": "newspaper"},
    "certificate": {"ru": "справка", "kk": "анықтама", "en": "certificate"},
    "personal": {"ru": "личный документ", "kk": "жеке құжат", "en": "personal document"},
    "manuscript": {"ru": "рукопись", "kk": "қолжазба", "en": "manuscript"},
    "audio": {"ru": "аудиозапись", "kk": "аудиожазба", "en": "audio recording"},
    "video": {"ru": "видеозапись", "kk": "бейнежазба", "en": "video recording"},
    "report": {"ru": "отчёт", "kk": "есеп", "en": "report"},
    "program": {"ru": "программа", "kk": "бағдарлама", "en": "program"},
}

# the project plan §1 «Поиск»: mandatory toponyms/terms. Seeded only into an empty table, then
# edited in the admin panel (T6.x).
DEFAULT_SYNONYMS: list[list[str]] = [
    ["Усть-Каменогорск", "Өскемен", "Оскемен", "Ust-Kamenogorsk", "Oskemen"],
    ["Риддер", "Лениногорск", "Ridder"],
    ["Алтай", "Зыряновск"],
    ["Семей", "Семипалатинск", "Semey", "Semipalatinsk"],
    ["Шемонаиха", "Shemonaikha"],
    ["Самар", "Самарское"],
    ["Үлкен Нарын", "Улкен Нарын", "Большенарымское"],
    ["Марқакөл", "Маркаколь"],
    ["Уланский", "Таврический"],
    ["ВОВ", "Великая Отечественная война", "Ұлы Отан соғысы", "Great Patriotic War"],
    ["фото", "фотография", "фотосурет", "photo", "photograph"],
    ["ВКО", "Восточно-Казахстанская область", "Шығыс Қазақстан облысы", "East Kazakhstan"],
]


@dataclass(frozen=True)
class IndexText:
    lang: str
    chunk_no: int
    title: str
    body: str
    file_id: uuid.UUID | None = None  # source file of an OCR chunk


@dataclass(frozen=True)
class IndexedType:
    model: type
    is_public: Callable[[Any], bool]
    texts: Callable[[Session, Any], list[IndexText]]


def _published(obj: Any) -> bool:
    return obj.workflow_status == WorkflowStatus.PUBLISHED


def document_is_public(document: Document) -> bool:
    """A document's description is public (card, search, catalog): published and
    description_status = public. File access is a separate rule (authz file.download)."""
    return _published(document) and document.description_status == DescriptionStatus.PUBLIC


def _t(value: dict[str, str] | None, lang: str) -> str:
    return ((value or {}).get(lang) or "").strip()


_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


def strip_html(text: str) -> str:
    return _SPACE_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", text or ""))).strip()


def _join(*parts: str | None) -> str:
    return "\n".join(p.strip() for p in parts if p and p.strip())


def _per_lang(title: dict[str, str], body: Callable[[str], str]) -> list[IndexText]:
    return [IndexText(lang, 0, _t(title, lang), body(lang)) for lang in LANGS if _t(title, lang)]


def chunk_text(text: str, size: int = OCR_CHUNK_CHARS) -> list[str]:
    """Splits on whitespace into chunks of at most `size` characters (longer words are cut)."""
    chunks: list[str] = []
    current = ""
    for word in text.split():
        while len(word) > size:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(word[:size])
            word = word[size:]
        if current and len(current) + 1 + len(word) > size:
            chunks.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        chunks.append(current)
    return chunks


def _document_texts(session: Session, document: Document) -> list[IndexText]:
    # Titles of unpublished containers/tags must not become searchable through a public
    # document (they would also show up in its snippet).
    case = document.case
    inventory = case.inventory if case is not None else None
    fund = inventory.fund if inventory is not None else None
    case = case if case is not None and _published(case) else None
    fund = fund if fund is not None and _published(fund) else None
    tags = [tag for tag in document.tags if _published(tag)]

    def body(lang: str) -> str:
        return _join(
            document.archive_code,
            document.date_text,
            DOC_TYPE_LABELS.get(document.doc_type or "", {}).get(lang),
            _t(document.authors, lang),
            ", ".join(_t(place, lang) for place in document.places if _t(place, lang)),
            _t(document.summary, lang),
            _t(document.historical_note, lang),
            ", ".join(_t(tag.name, lang) for tag in tags if _t(tag.name, lang)),
            _t(fund.title, lang) if fund is not None else None,
            _t(case.title, lang) if case is not None else None,
        )

    texts = _per_lang(document.title, body)
    if not texts:
        return []
    chunk_title = next((_t(document.title, lang) for lang in ("ru", "kk", "en") if _t(document.title, lang)), "")
    chunk_no = 0
    for file in files_repo.files_of_owner(session, "document", document.id):
        # Only text of files a visitor may open: never closed/restricted/unreviewed OCR.
        if not file.ocr_text or not authorize(None, FILE_DOWNLOAD, FileTarget(file, document=document)):
            continue
        for chunk in chunk_text(file.ocr_text):
            chunk_no += 1
            texts.append(IndexText(OCR_LANG, chunk_no, chunk_title, chunk, file.id))
    return texts


def _fund_texts(session: Session, fund: Fund) -> list[IndexText]:
    return _per_lang(fund.title, lambda lang: _join(fund.number, _t(fund.annotation, lang)))


def _page_texts(session: Session, page: Page) -> list[IndexText]:
    return _per_lang(page.title, lambda lang: _join(strip_html(_t(page.body, lang)), _t(page.seo_description, lang)))


def _branch_texts(session: Session, branch: Branch) -> list[IndexText]:
    return _per_lang(
        branch.name,
        lambda lang: _join(
            _t(branch.short_name, lang), _t(branch.address, lang), strip_html(_t(branch.description, lang)),
            strip_html(_t(branch.funds_summary, lang)),
        ),
    )


def _exhibition_texts(session: Session, exhibition: Exhibition) -> list[IndexText]:
    return _per_lang(
        exhibition.title,
        lambda lang: _join(exhibition.theme, exhibition.period, strip_html(_t(exhibition.intro, lang))),
    )


def _collection_texts(session: Session, collection: Collection) -> list[IndexText]:
    return _per_lang(
        collection.title,
        lambda lang: _join(collection.theme, collection.period, strip_html(_t(collection.description, lang))),
    )


def _news_texts(session: Session, news: News) -> list[IndexText]:
    return _per_lang(
        news.title, lambda lang: _join(_t(news.summary, lang), strip_html(_t(news.body, lang)))
    )


# object_type -> how it is indexed. Keys match workflow.WORKFLOW_OBJECTS object types.
INDEXED_TYPES: dict[str, IndexedType] = {
    "document": IndexedType(Document, document_is_public, _document_texts),
    "fund": IndexedType(Fund, _published, _fund_texts),
    "page": IndexedType(Page, _published, _page_texts),
    "branch": IndexedType(Branch, _published, _branch_texts),
    "exhibition": IndexedType(Exhibition, _published, _exhibition_texts),
    "collection": IndexedType(Collection, _published, _collection_texts),
    "news": IndexedType(News, _published, _news_texts),
}


def reindex_object(session: Session, object_type: str, obj: Any) -> int:
    """Rewrites the object's index rows (none if it is not public or `obj` is None).
    Returns the number of rows written. Does not commit; ignores non-indexed types."""
    spec = INDEXED_TYPES.get(object_type)
    if spec is None:
        return 0
    object_id = obj.id
    kept = search_repo.existing_embeddings(session, object_type, object_id)
    search_repo.delete_entries(session, object_type, object_id)
    if not spec.is_public(obj):
        return 0
    texts = spec.texts(session, obj)
    for text in texts:
        embedding, model = kept.get((text.lang, text.chunk_no, text.title, text.body), (None, None))
        search_repo.add_entry(
            session, object_type=object_type, object_id=object_id, lang=text.lang, chunk_no=text.chunk_no,
            title=text.title, body=text.body, file_id=text.file_id, embedding=embedding, embedding_model=model,
        )
    return len(texts)


# Containers whose titles are part of their documents' index text.
DOCUMENT_CONTAINERS = frozenset({"fund", "inventory", "case"})


def reindex_documents_under(session: Session, object_type: str, obj: Any) -> int:
    """After a fund/inventory/case save: its documents' text (container titles) may have
    changed, so they are re-indexed in the same transaction. Synchronous: a fund with
    thousands of documents makes that save slower (acceptable for the demo catalog).
    Returns rows written. Does not commit."""
    if object_type not in DOCUMENT_CONTAINERS:
        return 0
    return sum(
        reindex_object(session, "document", document)
        for document in search_repo.documents_under(session, object_type, obj.id)
    )


def remove_object(session: Session, object_type: str, object_id: uuid.UUID) -> None:
    """For deletes: drops the object's rows (search_entries has no FK). Does not commit."""
    search_repo.delete_entries(session, object_type, object_id)


def reindex_file_owner(session: Session, owner_type: str | None, owner_id: uuid.UUID | None) -> None:
    """Call after a file's access/OCR changes: its owner's OCR chunks depend on it."""
    if owner_type is None or owner_id is None or owner_type not in INDEXED_TYPES:
        return
    owner = files_repo.get_owner(session, INDEXED_TYPES[owner_type].model, owner_id)
    if owner is None:
        remove_object(session, owner_type, owner_id)
    else:
        reindex_object(session, owner_type, owner)


def reindex_all(session: Session) -> dict[str, int]:
    """Full rebuild: every public object re-indexed, rows of hidden/deleted objects and
    unknown types removed. Returns rows written per type. Does not commit."""
    written: dict[str, int] = {}
    for object_type, spec in INDEXED_TYPES.items():
        objects = list(session.scalars(select(spec.model)))
        written[object_type] = sum(reindex_object(session, object_type, obj) for obj in objects)
        search_repo.delete_entries_except(session, object_type, {obj.id for obj in objects})
    search_repo.delete_entries_of_types_except(session, set(INDEXED_TYPES))
    return written


def embed_pending(session: Session, settings: Settings, *, max_rows: int | None = None) -> int:
    """Fills vectors of rows that have none, one batch at a time: read the batch, end the
    transaction, call Ollama, write the vectors by row id in a new transaction (rows
    replaced meanwhile are skipped). Ends the session's current transaction first.
    Only one run at a time (pg advisory lock on a separate connection); a concurrent call
    returns 0 at once. Stops quietly (logs a warning) if Ollama is unavailable: search
    works without vectors. Returns rows embedded."""
    session.commit()
    with session.get_bind().engine.connect() as lock_conn:
        locked = search_repo.try_advisory_lock(lock_conn, EMBED_LOCK_KEY)
        lock_conn.commit()  # the lock is session-level: no transaction is kept open
        if not locked:
            logger.info("embeddings are already being computed by another process")
            return 0
        try:
            return _embed_batches(session, settings, max_rows)
        finally:
            search_repo.advisory_unlock(lock_conn, EMBED_LOCK_KEY)
            lock_conn.commit()


def _embed_batches(session: Session, settings: Settings, max_rows: int | None) -> int:
    done = 0
    while max_rows is None or done < max_rows:
        limit = EMBED_BATCH if max_rows is None else min(EMBED_BATCH, max_rows - done)
        pending = search_repo.pending_embeddings(session, limit)
        session.rollback()  # read-only; no transaction during the HTTP call
        if not pending:
            break
        inputs = [f"{title}\n\n{body}"[:EMBED_TEXT_CHARS] for _, title, body in pending]
        try:
            vectors = embed_texts(inputs, settings, timeout=EMBED_TIMEOUT_SECONDS)
        except EmbeddingUnavailable as exc:
            logger.warning("embeddings unavailable (%s): %d rows left without vectors", exc, len(pending))
            break
        for (entry_id, _, _), vector in zip(pending, vectors, strict=True):
            search_repo.set_embedding(session, entry_id, vector, settings.ollama_embed_model)
        session.commit()
        done += len(pending)
    return done


def embed_pending_background(bind: Engine) -> None:
    """BackgroundTask entry point (own session, after the response), bounded by
    EMBED_BACKGROUND_MAX_ROWS."""
    with Session(bind=bind) as session:
        try:
            embed_pending(session, get_settings(), max_rows=EMBED_BACKGROUND_MAX_ROWS)
        except Exception:
            logger.exception("background embedding failed")


def ensure_default_synonyms(session: Session) -> int:
    """Seeds DEFAULT_SYNONYMS only into an empty table (admin edits are kept). Does not commit."""
    if search_repo.all_synonym_term_sets(session):
        return 0
    for terms in DEFAULT_SYNONYMS:
        search_repo.add_synonym_group(session, terms, note="default (the project plan §1)")
    return len(DEFAULT_SYNONYMS)


def main(argv: list[str] | None = None) -> None:
    from app.db import get_sessionmaker

    parser = argparse.ArgumentParser(description="Rebuild the search index (search_entries).")
    parser.add_argument("--no-embed", action="store_true", help="skip Ollama embeddings")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    with get_sessionmaker()() as session:
        synonyms = ensure_default_synonyms(session)
        written = reindex_all(session)
        session.commit()
        print(f"synonym groups added: {synonyms}")
        print("rows written: " + ", ".join(f"{k}={v}" for k, v in written.items()))
        if not args.no_embed:
            print(f"rows embedded: {embed_pending(session, get_settings())}")
        total, missing = search_repo.count_entries(session)
        print(f"index rows: {total}, without vector: {missing}")


if __name__ == "__main__":
    main()
