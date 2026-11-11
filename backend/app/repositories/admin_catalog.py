import uuid

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models import Branch, Case, DigitalFile, Document, Fund, Inventory
from app.models.enums import WorkflowStatus

# kind -> (model, column holding the human number / code)
_NUMBER = {"fund": Fund.number, "inventory": Inventory.number, "case": Case.number, "document": Document.archive_code}
_MODELS = {"fund": Fund, "inventory": Inventory, "case": Case, "document": Document}
_PARENT = {"inventory": Inventory.fund_id, "case": Case.inventory_id, "document": Document.case_id}
_CHILD_COUNT = {
    "fund": select(func.count()).where(Inventory.fund_id == Fund.id).correlate(Fund).scalar_subquery(),
    "inventory": select(func.count()).where(Case.inventory_id == Inventory.id).correlate(Inventory).scalar_subquery(),
    "case": select(func.count()).where(Document.case_id == Case.id).correlate(Case).scalar_subquery(),
}


def _scoped(stmt: Select, kind: str, branch_id: uuid.UUID) -> Select:
    """Restrict to one branch through the hierarchy fund.branch_id."""
    if kind == "fund":
        return stmt.where(Fund.branch_id == branch_id)
    if kind == "inventory":
        return stmt.join(Fund, Fund.id == Inventory.fund_id).where(Fund.branch_id == branch_id)
    if kind == "case":
        return (
            stmt.join(Inventory, Inventory.id == Case.inventory_id)
            .join(Fund, Fund.id == Inventory.fund_id)
            .where(Fund.branch_id == branch_id)
        )
    return stmt.where(Document.branch_id == branch_id)


def search(
    session: Session,
    kind: str,
    *,
    q: str | None,
    parent_id: uuid.UUID | None,
    status: WorkflowStatus | None,
    branch_id: uuid.UUID | None,
    offset: int,
    limit: int,
) -> tuple[list[tuple[object, int | None]], int]:
    model = _MODELS[kind]
    base = select(model)
    if branch_id is not None:
        base = _scoped(base, kind, branch_id)
    if parent_id is not None and kind in _PARENT:
        base = base.where(_PARENT[kind] == parent_id)
    if status is not None:
        base = base.where(model.workflow_status == status)
    if q:
        like = f"%{q.replace('%', r'\%').replace('_', r'\_')}%"
        base = base.where(or_(_NUMBER[kind].ilike(like), cast(model.title, String).ilike(like)))
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    count_col = _CHILD_COUNT.get(kind)
    stmt = base.add_columns(count_col if count_col is not None else func.cast(None, String)).order_by(
        _NUMBER[kind], model.id
    ).offset(offset).limit(limit)
    return [(row[0], row[1]) for row in session.execute(stmt)], total


def number_of(kind: str, obj: object) -> str | None:
    return obj.archive_code if kind == "document" else obj.number  # type: ignore[attr-defined]


def count_children(session: Session, kind: str, object_id: uuid.UUID) -> int:
    column = {"fund": Inventory.fund_id, "inventory": Case.inventory_id, "case": Document.case_id}.get(kind)
    if column is None:
        return 0
    return session.scalar(select(func.count()).where(column == object_id)) or 0


def count_files(session: Session, owner_type: str, owner_id: uuid.UUID) -> int:
    return session.scalar(
        select(func.count()).where(DigitalFile.owner_type == owner_type, DigitalFile.owner_id == owner_id)
    ) or 0


def branch_options(session: Session, branch_id: uuid.UUID | None) -> list[Branch]:
    stmt = select(Branch).order_by(Branch.position, Branch.slug)
    if branch_id is not None:
        stmt = stmt.where(Branch.id == branch_id)
    return list(session.scalars(stmt))
