"""Queries for «similar materials» (T4.12). Only description rows of the search index
(chunk_no = 0) are used: OCR chunks belong to files whose access can change, and the
description is what the visitor sees on the card anyway."""

import uuid
from sqlalchemy import and_, false, func, or_, select, tuple_
from sqlalchemy.orm import Session

from app.models import Case, Document, Inventory, SearchEntry, Tag
from app.models.catalog import document_tags
from app.models.enums import DescriptionStatus, WorkflowStatus

Key = tuple[str, uuid.UUID]


def description_vectors(session: Session, keys: list[Key]) -> dict[Key, list[list[float]]]:
    """Embeddings of the description rows (all languages) of the given objects."""
    if not keys:
        return {}
    stmt = select(SearchEntry.object_type, SearchEntry.object_id, SearchEntry.embedding).where(
        tuple_(SearchEntry.object_type, SearchEntry.object_id).in_(keys),
        SearchEntry.chunk_no == 0,
        SearchEntry.embedding.is_not(None),
    )
    result: dict[Key, list[list[float]]] = {}
    for row in session.execute(stmt):
        result.setdefault((row.object_type, row.object_id), []).append(list(row.embedding))
    return result


def nearest_objects(
    session: Session, vector: list[float], types: list[str], exclude: set[uuid.UUID], max_distance: float, limit: int
) -> list[tuple[str, uuid.UUID, float]]:
    """Objects of `types` whose description is nearest to `vector` (cosine, HNSW index),
    best distance per object."""
    distance = SearchEntry.embedding.cosine_distance(vector).label("distance")
    conditions = [SearchEntry.embedding.is_not(None), SearchEntry.chunk_no == 0, SearchEntry.object_type.in_(types)]
    if exclude:
        conditions.append(SearchEntry.object_id.not_in(exclude))
    nearest = select(SearchEntry.object_type, SearchEntry.object_id, distance).where(*conditions)
    nearest = nearest.order_by(distance).limit(limit * 4).subquery()
    best = func.min(nearest.c.distance).label("distance")
    stmt = (
        select(nearest.c.object_type, nearest.c.object_id, best)
        .where(nearest.c.distance <= max_distance)
        .group_by(nearest.c.object_type, nearest.c.object_id)
        .order_by(best, nearest.c.object_id)
        .limit(limit)
    )
    return [(r.object_type, r.object_id, float(r.distance)) for r in session.execute(stmt)]


def document_fund_id(session: Session, document: Document) -> uuid.UUID | None:
    if document.case_id is None:
        return None
    stmt = select(Inventory.fund_id).join(Case, Case.inventory_id == Inventory.id).where(Case.id == document.case_id)
    return session.scalar(stmt)


def fallback_documents(
    session: Session, tag_ids: list[uuid.UUID], fund_id: uuid.UUID | None, exclude: set[uuid.UUID], limit: int
) -> list[uuid.UUID]:
    """Public documents sharing published tags (most shared first), then from the same fund."""
    if not tag_ids and fund_id is None:
        return []
    shared = func.count(Tag.id)
    matches = [shared > 0]
    order = [shared.desc()]
    if fund_id is not None:
        same_fund = func.coalesce(Inventory.fund_id == fund_id, false())
        matches.append(same_fund)
        order.append(same_fund.desc())
    stmt = (
        select(Document.id)
        .outerjoin(document_tags, and_(document_tags.c.document_id == Document.id, document_tags.c.tag_id.in_(tag_ids)))
        .outerjoin(Tag, and_(Tag.id == document_tags.c.tag_id, Tag.workflow_status == WorkflowStatus.PUBLISHED))
        .outerjoin(Case, Case.id == Document.case_id)
        .outerjoin(Inventory, Inventory.id == Case.inventory_id)
        .where(
            Document.workflow_status == WorkflowStatus.PUBLISHED,
            Document.description_status == DescriptionStatus.PUBLIC,
        )
        .group_by(Document.id, Document.archive_code, Inventory.fund_id)
        .having(or_(*matches))
        .order_by(*order, Document.archive_code, Document.id)
        .limit(limit)
    )
    if exclude:
        stmt = stmt.where(Document.id.not_in(exclude))
    return list(session.scalars(stmt))
