import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DigitalFile, Document, DocumentAnnotation, Tag
from app.models.enums import WorkflowStatus


def annotations_of(session: Session, document_id: uuid.UUID) -> list[DocumentAnnotation]:
    stmt = select(DocumentAnnotation).where(DocumentAnnotation.document_id == document_id).order_by(DocumentAnnotation.lang)
    return list(session.scalars(stmt))


def get_annotation(session: Session, document_id: uuid.UUID, lang: str) -> DocumentAnnotation | None:
    stmt = select(DocumentAnnotation).where(DocumentAnnotation.document_id == document_id, DocumentAnnotation.lang == lang)
    return session.scalar(stmt)


def approved_annotation(session: Session, document_id: uuid.UUID, lang: str) -> DocumentAnnotation | None:
    annotation = get_annotation(session, document_id, lang)
    return annotation if annotation is not None and annotation.status == "approved" else None


def published_tags(session: Session) -> list[Tag]:
    stmt = select(Tag).where(Tag.workflow_status == WorkflowStatus.PUBLISHED).order_by(Tag.created_at, Tag.id)
    return list(session.scalars(stmt))


def tags_by_ids(session: Session, ids: list[uuid.UUID]) -> list[Tag]:
    return list(session.scalars(select(Tag).where(Tag.id.in_(ids)))) if ids else []


def files_with_hash(session: Session, sha256: str, exclude_file_ids: set[uuid.UUID]) -> list[DigitalFile]:
    stmt = select(DigitalFile).where(DigitalFile.sha256 == sha256, DigitalFile.owner_type == "document")
    if exclude_file_ids:
        stmt = stmt.where(DigitalFile.id.not_in(exclude_file_ids))
    return list(session.scalars(stmt.limit(50)))


def documents_by_ids(session: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, Document]:
    if not ids:
        return {}
    return {d.id: d for d in session.scalars(select(Document).where(Document.id.in_(ids)))}


def unpublished_documents(session: Session, exclude_id: uuid.UUID, limit: int) -> list[Document]:
    """Newest documents that are not yet public (draft, review, rework…): they have no vectors in the search index."""
    live = (WorkflowStatus.APPROVED, WorkflowStatus.PUBLISHED)
    stmt = (
        select(Document).where(Document.id != exclude_id, Document.workflow_status.not_in(live))
        .order_by(Document.updated_at.desc()).limit(limit)
    )
    return list(session.scalars(stmt))
