import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Collection, CollectionItem, Document, HistoricalEvent, Person, event_documents, person_documents
from app.models.enums import WorkflowStatus
from app.repositories.catalog import CHAIN, PUBLIC_DOCUMENT, i18n_text, ilike

PUBLISHED = WorkflowStatus.PUBLISHED


def public_documents(session: Session, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Any]:
    """Rows of (Document, chain columns) for the ids that are public; the rest are silently absent."""
    if not ids:
        return {}
    stmt = (
        select(Document, CHAIN)
        .select_from(Document)
        .outerjoin(CHAIN, CHAIN.c.case_id == Document.case_id)
        .where(PUBLIC_DOCUMENT, Document.id.in_(ids))
    )
    return {row.Document.id: row for row in session.execute(stmt)}


def list_collections(session: Session, q: str, theme: str | None, period: str | None) -> list[Collection]:
    stmt = select(Collection).where(Collection.workflow_status == PUBLISHED, Collection.slug.is_not(None))
    if theme:
        stmt = stmt.where(Collection.theme == theme)
    if period:
        stmt = stmt.where(Collection.period == period)
    if q:
        stmt = stmt.where(or_(ilike(i18n_text(Collection.title), q), ilike(i18n_text(Collection.description), q)))
    return list(session.scalars(stmt.order_by(Collection.created_at, Collection.slug)))


def collection_facets(session: Session, column: Any) -> list[Any]:
    stmt = (
        select(column, func.count())
        .where(Collection.workflow_status == PUBLISHED, column.is_not(None))
        .group_by(column)
        .order_by(func.count().desc(), column)
    )
    return list(session.execute(stmt).all())


def get_collection(session: Session, slug: str) -> Collection | None:
    return session.scalar(select(Collection).where(Collection.slug == slug, Collection.workflow_status == PUBLISHED))


def collection_documents(session: Session, collection_id: uuid.UUID) -> list[CollectionItem]:
    stmt = (
        select(CollectionItem)
        .where(CollectionItem.collection_id == collection_id, CollectionItem.item_type == "document")
        .order_by(CollectionItem.position)
    )
    return list(session.scalars(stmt))


def public_item_counts(session: Session, collection_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Only entries that point at a public document are counted (the page shows exactly these)."""
    stmt = (
        select(CollectionItem.collection_id, func.count())
        .join(Document, Document.id == CollectionItem.item_id)
        .where(CollectionItem.collection_id.in_(collection_ids), CollectionItem.item_type == "document", PUBLIC_DOCUMENT)
        .group_by(CollectionItem.collection_id)
    )
    return {cid: n for cid, n in session.execute(stmt)}


def list_persons(session: Session, q: str) -> list[Person]:
    stmt = select(Person).where(Person.workflow_status == PUBLISHED, Person.slug.is_not(None))
    if q:
        stmt = stmt.where(or_(ilike(i18n_text(Person.name), q), ilike(i18n_text(Person.bio), q)))
    return list(session.scalars(stmt.order_by(Person.birth_year.nulls_last(), Person.slug)))


def get_person(session: Session, slug: str) -> Person | None:
    return session.scalar(select(Person).where(Person.slug == slug, Person.workflow_status == PUBLISHED))


def person_document_ids(session: Session, person_id: uuid.UUID) -> list[uuid.UUID]:
    return list(session.scalars(select(person_documents.c.document_id).where(person_documents.c.person_id == person_id)))


def list_events(session: Session, *, dated: bool, mapped: bool) -> list[HistoricalEvent]:
    stmt = select(HistoricalEvent).where(HistoricalEvent.workflow_status == PUBLISHED, HistoricalEvent.slug.is_not(None))
    if dated:
        stmt = stmt.where(HistoricalEvent.date_from.is_not(None))
    if mapped:
        stmt = stmt.where(HistoricalEvent.lat.is_not(None), HistoricalEvent.lng.is_not(None))
    return list(session.scalars(stmt.order_by(HistoricalEvent.date_from.nulls_last(), HistoricalEvent.slug)))


def event_document_ids(session: Session, event_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[uuid.UUID]]:
    out: dict[uuid.UUID, list[uuid.UUID]] = {}
    stmt = select(event_documents.c.event_id, event_documents.c.document_id).where(event_documents.c.event_id.in_(event_ids))
    for event_id, document_id in session.execute(stmt):
        out.setdefault(event_id, []).append(document_id)
    return out
