from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Branch
from app.models.enums import WorkflowStatus


def list_published(session: Session) -> list[Branch]:
    stmt = (
        select(Branch)
        .where(Branch.workflow_status == WorkflowStatus.PUBLISHED, Branch.slug.is_not(None))
        .order_by(Branch.position, Branch.slug)
    )
    return list(session.scalars(stmt))


def get_published(session: Session, slug: str) -> Branch | None:
    return session.scalar(
        select(Branch).where(Branch.slug == slug, Branch.workflow_status == WorkflowStatus.PUBLISHED)
    )
