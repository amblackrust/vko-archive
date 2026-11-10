"""Published legal acts and the compliance page (T5.6, T5.7). Visibility is decided here:
only `workflow_status = published` rows are returned."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DigitalFile, LegalAct, Page, SiteSetting
from app.models.enums import WorkflowStatus

PUBLISHED = WorkflowStatus.PUBLISHED


def published_acts(session: Session, slug_prefix: str | None = None) -> list[tuple[LegalAct, DigitalFile | None]]:
    stmt = (
        select(LegalAct, DigitalFile)
        .outerjoin(DigitalFile, DigitalFile.id == LegalAct.file_id)
        .where(LegalAct.workflow_status == PUBLISHED)
        .order_by(LegalAct.date.desc().nulls_last(), LegalAct.slug)
    )
    if slug_prefix is not None:
        stmt = stmt.where(LegalAct.slug.startswith(slug_prefix))
    return [(act, file) for act, file in session.execute(stmt).all()]


def published_page(session: Session, key: str) -> Page | None:
    return session.scalar(select(Page).where(Page.key == key, Page.workflow_status == PUBLISHED))


def site_setting(session: Session, key: str):
    row = session.get(SiteSetting, key)
    return row.value if row else None
