"""Published exhibitions and exhibits (T5.13). Visibility is decided here."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Document, Exhibit, Exhibition
from app.models.enums import WorkflowStatus
from app.repositories.catalog import PUBLIC_DOCUMENT, i18n_text, ilike

PUBLISHED = WorkflowStatus.PUBLISHED


def published_exhibitions(session: Session, theme: str, period: str, q: str) -> list[Exhibition]:
    stmt = select(Exhibition).where(Exhibition.workflow_status == PUBLISHED)
    if theme:
        stmt = stmt.where(Exhibition.theme == theme)
    if period:
        stmt = stmt.where(Exhibition.period == period)
    if q:
        stmt = stmt.where(ilike(func.concat_ws(" ", i18n_text(Exhibition.title), i18n_text(Exhibition.intro)), q))
    return list(session.scalars(stmt.order_by(Exhibition.created_at.desc(), Exhibition.slug)))


def facet_values(session: Session) -> tuple[list[str], list[str]]:
    rows = session.execute(
        select(Exhibition.theme, Exhibition.period).where(Exhibition.workflow_status == PUBLISHED)
    ).all()
    themes = sorted({r.theme for r in rows if r.theme})
    periods = sorted({r.period for r in rows if r.period})
    return themes, periods


def published_by_slug(session: Session, slug: str) -> Exhibition | None:
    return session.scalar(select(Exhibition).where(Exhibition.slug == slug, Exhibition.workflow_status == PUBLISHED))


def published_by_id(session: Session, exhibition_id: uuid.UUID) -> Exhibition | None:
    return session.scalar(
        select(Exhibition).where(Exhibition.id == exhibition_id, Exhibition.workflow_status == PUBLISHED)
    )


def published_exhibits(session: Session, exhibition_ids: list[uuid.UUID]) -> list[Exhibit]:
    stmt = (
        select(Exhibit)
        .where(Exhibit.exhibition_id.in_(exhibition_ids), Exhibit.workflow_status == PUBLISHED)
        .order_by(Exhibit.exhibition_id, Exhibit.position, Exhibit.slug)
    )
    return list(session.scalars(stmt))


def public_document_ids(session: Session, ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not ids:
        return set()
    return set(session.scalars(select(Document.id).where(Document.id.in_(ids), PUBLIC_DOCUMENT)))
