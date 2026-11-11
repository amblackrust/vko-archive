import uuid
from typing import Any

from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session

from app.models import Branch, Case, Document, Fund, Inventory


def search(
    session: Session,
    model: type,
    *,
    label_field: str,
    lang: str | None,
    status: str | None,
    q: str | None,
    branch_id: uuid.UUID | None,
    branch_only: bool,
    offset: int,
    limit: int,
) -> tuple[list[Any], int]:
    """Objects of one type filtered by the translation status of a language
    (a language absent from translation_status counts as "missing")."""
    stmt = select(model)
    if lang and status:
        stmt = stmt.where(func.coalesce(model.translation_status[lang].astext, "missing") == status)
    if q:
        pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(cast(getattr(model, label_field), String).ilike(pattern, escape="\\"))
    if branch_only:
        if model is Branch:
            stmt = stmt.where(Branch.id == branch_id)
        elif model in (Fund, Document):
            stmt = stmt.where(model.branch_id == branch_id)
        elif model is Inventory:
            stmt = stmt.join(Fund, Fund.id == Inventory.fund_id).where(Fund.branch_id == branch_id)
        elif model is Case:
            stmt = (
                stmt.join(Inventory, Inventory.id == Case.inventory_id)
                .join(Fund, Fund.id == Inventory.fund_id)
                .where(Fund.branch_id == branch_id)
            )
        else:
            return [], 0
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.order_by(model.updated_at.desc(), model.id).offset(offset).limit(limit))
    return list(rows), total
