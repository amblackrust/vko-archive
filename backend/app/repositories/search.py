"""Queries over the unified search index (`search_entries`) and the synonym table.

The FTS config is `simple` (Postgres has no Kazakh stemmer; Russian/Kazakh/English share
one index). Every value is a bound parameter; tsquery text is built by the search service
from \\w-only lexemes.
"""

import uuid
from typing import Any

from sqlalchemy import delete, func, insert, literal, literal_column, select, update
from sqlalchemy.orm import Session

from app.models import SearchEntry, Synonym

_SIMPLE = literal_column("'simple'::regconfig")
# Private-use characters mark highlights in ts_headline output; the service escapes the
# text and turns them into <mark> tags, so indexed text can never inject HTML.
HL_START = ""
HL_STOP = ""
_HEADLINE_OPTIONS = f"StartSel={HL_START}, StopSel={HL_STOP}, MaxWords=35, MinWords=15"

ObjectKey = tuple[str, uuid.UUID]


def _tsquery(query: str):
    return func.to_tsquery(_SIMPLE, query)


def existing_embeddings(session: Session, object_type: str, object_id: uuid.UUID) -> dict[tuple, tuple[list[float], str]]:
    """(lang, chunk_no, title, body) -> (embedding, model) of the object's current rows,
    so unchanged texts keep their vectors on reindex."""
    rows = session.execute(
        select(
            SearchEntry.lang, SearchEntry.chunk_no, SearchEntry.title, SearchEntry.body,
            SearchEntry.embedding, SearchEntry.embedding_model,
        ).where(
            SearchEntry.object_type == object_type,
            SearchEntry.object_id == object_id,
            SearchEntry.embedding.is_not(None),
        )
    )
    return {(r.lang, r.chunk_no, r.title, r.body): (r.embedding, r.embedding_model) for r in rows}


def delete_entries(session: Session, object_type: str, object_id: uuid.UUID) -> None:
    session.execute(
        delete(SearchEntry).where(SearchEntry.object_type == object_type, SearchEntry.object_id == object_id)
    )


def delete_entries_except(session: Session, object_type: str, keep_ids: set[uuid.UUID]) -> int:
    stmt = delete(SearchEntry).where(SearchEntry.object_type == object_type)
    if keep_ids:
        stmt = stmt.where(SearchEntry.object_id.not_in(keep_ids))
    return session.execute(stmt).rowcount


def delete_entries_of_types_except(session: Session, known_types: set[str]) -> int:
    return session.execute(delete(SearchEntry).where(SearchEntry.object_type.not_in(known_types))).rowcount


def add_entry(
    session: Session,
    *,
    object_type: str,
    object_id: uuid.UUID,
    lang: str,
    chunk_no: int,
    title: str,
    body: str,
    embedding: list[float] | None = None,
    embedding_model: str | None = None,
) -> None:
    tsv = func.setweight(func.to_tsvector(_SIMPLE, literal(title)), literal_column("'A'")).op("||")(
        func.setweight(func.to_tsvector(_SIMPLE, literal(body)), literal_column("'B'"))
    )
    session.execute(
        insert(SearchEntry).values(
            id=uuid.uuid4(), object_type=object_type, object_id=object_id, lang=lang, chunk_no=chunk_no,
            title=title, body=body, tsv=tsv, embedding=embedding, embedding_model=embedding_model,
        )
    )


def pending_embeddings(session: Session, limit: int) -> list[SearchEntry]:
    stmt = select(SearchEntry).where(SearchEntry.embedding.is_(None))
    return list(session.scalars(stmt.order_by(SearchEntry.updated_at, SearchEntry.id).limit(limit)))


def set_embedding(session: Session, entry_id: uuid.UUID, vector: list[float], model: str) -> None:
    session.execute(
        update(SearchEntry)
        .where(SearchEntry.id == entry_id)
        .values(embedding=vector, embedding_model=model)
        .execution_options(synchronize_session=False)
    )


def count_entries(session: Session) -> tuple[int, int]:
    """(total rows, rows without embedding)."""
    total = session.scalar(select(func.count()).select_from(SearchEntry)) or 0
    missing = session.scalar(select(func.count()).where(SearchEntry.embedding.is_(None))) or 0
    return total, missing


def fts_candidates(session: Session, query: str, limit: int) -> list[tuple[str, uuid.UUID, float]]:
    q = _tsquery(query)
    rank = func.max(func.ts_rank_cd(SearchEntry.tsv, q)).label("rank")
    stmt = (
        select(SearchEntry.object_type, SearchEntry.object_id, rank)
        .where(SearchEntry.tsv.op("@@")(q))
        .group_by(SearchEntry.object_type, SearchEntry.object_id)
        .order_by(rank.desc())
        .limit(limit)
    )
    return [(r.object_type, r.object_id, float(r.rank)) for r in session.execute(stmt)]


def trigram_candidates(session: Session, text: str, limit: int) -> list[tuple[str, uuid.UUID, float]]:
    """Typos and spelling variants: word similarity of the query to entry titles
    (`<%` uses pg_trgm.word_similarity_threshold, default 0.6, and the trigram GIN index)."""
    similarity = func.max(func.word_similarity(literal(text), SearchEntry.title)).label("sim")
    stmt = (
        select(SearchEntry.object_type, SearchEntry.object_id, similarity)
        .where(literal(text).op("<%")(SearchEntry.title))
        .group_by(SearchEntry.object_type, SearchEntry.object_id)
        .order_by(similarity.desc())
        .limit(limit)
    )
    return [(r.object_type, r.object_id, float(r.sim)) for r in session.execute(stmt)]


def vector_candidates(
    session: Session, vector: list[float], max_distance: float, limit: int
) -> list[tuple[str, uuid.UUID, float]]:
    """Nearest entries by cosine distance (HNSW index), best distance per object."""
    distance = SearchEntry.embedding.cosine_distance(vector).label("distance")
    nearest = (
        select(SearchEntry.object_type, SearchEntry.object_id, distance)
        .where(SearchEntry.embedding.is_not(None))
        .order_by(distance)
        .limit(limit * 3)
        .subquery()
    )
    best = func.min(nearest.c.distance).label("distance")
    stmt = (
        select(nearest.c.object_type, nearest.c.object_id, best)
        .where(nearest.c.distance <= max_distance)
        .group_by(nearest.c.object_type, nearest.c.object_id)
        .order_by(best)
        .limit(limit)
    )
    return [(r.object_type, r.object_id, float(r.distance)) for r in session.execute(stmt)]


def entries_for(session: Session, keys: list[ObjectKey], query: str | None) -> list[Any]:
    """All rows (languages, chunks) of the given objects with a highlighted fragment of
    the body for `query` (None → no highlight)."""
    if not keys:
        return []
    ids = {object_id for _, object_id in keys}
    if query:
        headline = func.ts_headline(_SIMPLE, SearchEntry.body, _tsquery(query), literal(_HEADLINE_OPTIONS))
    else:
        headline = literal(None)
    stmt = select(
        SearchEntry.object_type, SearchEntry.object_id, SearchEntry.lang, SearchEntry.title,
        SearchEntry.chunk_no, SearchEntry.body, headline.label("headline"),
    ).where(SearchEntry.object_id.in_(ids))
    wanted = set(keys)
    return [row for row in session.execute(stmt) if (row.object_type, row.object_id) in wanted]


def load_objects(session: Session, model: type, ids: set[uuid.UUID]) -> list[Any]:
    if not ids:
        return []
    return list(session.scalars(select(model).where(model.id.in_(ids))))


def active_synonym_groups(session: Session) -> list[list[str]]:
    return [list(terms) for terms in session.scalars(select(Synonym.terms).where(Synonym.is_active.is_(True)))]


def all_synonym_term_sets(session: Session) -> list[frozenset[str]]:
    return [frozenset(t.lower() for t in terms) for terms in session.scalars(select(Synonym.terms))]


def add_synonym_group(session: Session, terms: list[str], note: str | None) -> None:
    session.add(Synonym(terms=terms, note=note, is_active=True))
