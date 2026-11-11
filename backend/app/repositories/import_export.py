import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Branch, Case, Document, Fund, Inventory
from app.models.enums import WorkflowStatus


def documents_by_codes(session: Session, codes: list[str]) -> dict[str, Document]:
    if not codes:
        return {}
    stmt = (
        select(Document)
        .where(Document.archive_code.in_(codes))
        .options(joinedload(Document.case).joinedload(Case.inventory).joinedload(Inventory.fund))
    )
    return {doc.archive_code: doc for doc in session.scalars(stmt) if doc.archive_code}


def find_case(
    session: Session, branch_id: uuid.UUID | None, fund_number: str, inventory_number: str, case_number: str
) -> Case | None:
    """Case by its numbers inside one archive (branch); NULL branch is the archive-wide one."""
    stmt = (
        select(Case)
        .join(Inventory, Inventory.id == Case.inventory_id)
        .join(Fund, Fund.id == Inventory.fund_id)
        .where(
            Fund.number == fund_number,
            Fund.branch_id.is_not_distinct_from(branch_id),
            Inventory.number == inventory_number,
            Case.number == case_number,
        )
        .options(joinedload(Case.inventory).joinedload(Inventory.fund))
    )
    return session.scalars(stmt).one_or_none()


def get_branch(session: Session, branch_id: uuid.UUID) -> Branch | None:
    return session.get(Branch, branch_id)


def list_branches(session: Session, only_id: uuid.UUID | None) -> list[Branch]:
    stmt = select(Branch).order_by(Branch.position, Branch.slug)
    if only_id is not None:
        stmt = stmt.where(Branch.id == only_id)
    return list(session.scalars(stmt))


def documents_for_export(
    session: Session,
    *,
    branch_id: uuid.UUID | None,
    only_branch: bool,
    workflow_status: WorkflowStatus | None,
    limit: int,
) -> list[Document]:
    stmt = select(Document).options(
        joinedload(Document.case).joinedload(Case.inventory).joinedload(Inventory.fund)
    )
    if only_branch:
        stmt = stmt.where(Document.branch_id == branch_id)
    if workflow_status is not None:
        stmt = stmt.where(Document.workflow_status == workflow_status)
    stmt = stmt.order_by(Document.archive_code.nulls_last(), Document.id).limit(limit)
    return list(session.scalars(stmt).unique())
