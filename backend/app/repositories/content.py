"""Public CMS content (T5.2, T5.3, T5.16): published pages, FAQ and site settings."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FAQ, Page, SiteSetting, WorkflowStatus


def published_page(session: Session, key: str) -> Page | None:
    return session.scalar(
        select(Page).where(Page.key == key, Page.workflow_status == WorkflowStatus.PUBLISHED)
    )


def published_faqs(session: Session) -> list[FAQ]:
    return list(
        session.scalars(
            select(FAQ)
            .where(FAQ.workflow_status == WorkflowStatus.PUBLISHED)
            .order_by(FAQ.category, FAQ.position, FAQ.created_at)
        )
    )


def setting_value(session: Session, key: str) -> Any:
    row = session.get(SiteSetting, key)
    return row.value if row is not None else None
