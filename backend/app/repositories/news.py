"""Published news (T5.14). Visibility is decided here."""

import math
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Exhibition, News
from app.models.enums import WorkflowStatus
from app.repositories.catalog import i18n_text, ilike

PUBLISHED = WorkflowStatus.PUBLISHED


def search(
    session: Session, category: str, q: str, descending: bool, page: int, per_page: int
) -> tuple[int, list[News]]:
    clauses = [News.workflow_status == PUBLISHED]
    if category:
        clauses.append(News.category == category)
    if q:
        clauses.append(ilike(func.concat_ws(" ", i18n_text(News.title), i18n_text(News.summary)), q))
    total = session.scalar(select(func.count()).select_from(News).where(*clauses)) or 0
    date = News.published_at.desc().nulls_last() if descending else News.published_at.asc().nulls_last()
    stmt = select(News).where(*clauses).order_by(date, News.slug).limit(per_page).offset((page - 1) * per_page)
    return total, list(session.scalars(stmt))


def pages(total: int, per_page: int) -> int:
    return max(1, math.ceil(total / per_page))


def categories(session: Session) -> list[str]:
    stmt = select(News.category).where(News.workflow_status == PUBLISHED, News.category.is_not(None)).distinct()
    return sorted(session.scalars(stmt))


def published_by_slug(session: Session, slug: str) -> News | None:
    return session.scalar(select(News).where(News.slug == slug, News.workflow_status == PUBLISHED))


def published_by_id(session: Session, news_id: uuid.UUID) -> News | None:
    return session.scalar(select(News).where(News.id == news_id, News.workflow_status == PUBLISHED))


def published_exhibition(session: Session, exhibition_id: uuid.UUID) -> Exhibition | None:
    return session.scalar(
        select(Exhibition).where(Exhibition.id == exhibition_id, Exhibition.workflow_status == PUBLISHED)
    )
