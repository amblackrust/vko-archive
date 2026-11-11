"""Admin CRUD of funds, inventories, cases and documents (T6.5).

Parents (fund of an inventory, inventory of a case) are fixed at creation; a document may be
moved to another case. documents.branch_id is always derived from the hierarchy by
`workflow.save_with_version`; only a document outside the hierarchy carries its own branch.
Access (`file_access`, `description_status`) is edited separately from publication
(`workflow_status`, changed only by the workflow transitions).
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Branch, Case, Document, Fund, Inventory
from app.models.enums import WorkflowStatus
from app.repositories import admin_catalog as repo
from app.schemas.admin_catalog import CaseIn, DocumentIn, FundIn, InventoryIn
from app.schemas.admin_common import ListItem, ListPage
from app.services import admin_common as common
from app.services.admin_common import Spec
from app.services.authz import AuthUser, document_branch_id, require
from app.services.errors import Conflict, InvalidInput, NotFound

SPECS: dict[str, Spec] = {
    "fund": Spec("fund", Fund, FundIn, "catalog", text_required=("title",)),
    "inventory": Spec("inventory", Inventory, InventoryIn, "catalog", create_only=frozenset({"fund_id"})),
    "case": Spec("case", Case, CaseIn, "catalog", create_only=frozenset({"inventory_id"})),
    "document": Spec("document", Document, DocumentIn, "catalog", text_required=("title",)),
}


def spec_of(kind: str) -> Spec:
    spec = SPECS.get(kind)
    if spec is None:
        raise NotFound()
    return spec


def _get(session: Session, model: type, ident: uuid.UUID | None) -> Any:
    obj = session.get(model, ident) if ident is not None else None
    if obj is None:
        raise InvalidInput("unknown_parent")
    return obj


def _check_branch(session: Session, branch_id: uuid.UUID | None) -> None:
    if branch_id is not None and session.get(Branch, branch_id) is None:
        raise InvalidInput("unknown_branch")


def _label(obj: Any, kind: str) -> str:
    title = obj.title or {}
    return f"{repo.number_of(kind, obj) or ''} {title.get('ru') or next(iter(title.values()), '')}".strip()


def _path(kind: str, obj: Any) -> list[tuple[str, Any, str]]:
    """Ancestors from the fund down to the direct parent."""
    case = obj.case if kind == "document" else None
    inventory = obj.inventory if kind == "case" else case.inventory if case else None
    fund = obj.fund if kind == "inventory" else inventory.fund if inventory else None
    chain = [("fund", fund), ("inventory", inventory), ("case", case)]
    return [(k, o.id, _label(o, k)) for k, o in chain if o is not None]


def search(
    session: Session, user: AuthUser, kind: str, *, q: str | None, parent_id: uuid.UUID | None,
    status: WorkflowStatus | None, page: int, page_size: int, ip: str | None,
) -> tuple[list[tuple[Any, int | None]], int]:
    spec_of(kind)
    require(session, user, "catalog.view", ip=ip)
    return repo.search(
        session, kind, q=q, parent_id=parent_id, status=status,
        branch_id=user.branch_id if user.branch_scoped else None,
        offset=(page - 1) * page_size, limit=page_size,
    )


def list_page(
    session: Session, user: AuthUser, kind: str, *, q: str | None, parent_id: uuid.UUID | None,
    status: WorkflowStatus | None, page: int, page_size: int, ip: str | None,
) -> ListPage:
    rows, total = search(session, user, kind, q=q, parent_id=parent_id, status=status, page=page, page_size=page_size, ip=ip)
    items = [
        ListItem(
            id=obj.id, kind=kind, number=repo.number_of(kind, obj), title=obj.title,
            workflow_status=obj.workflow_status.value, version=obj.version, updated_at=obj.updated_at,
            parent_id=getattr(obj, "fund_id", None) or getattr(obj, "inventory_id", None) or getattr(obj, "case_id", None),
            children=children, extra={"is_demo": obj.is_demo},
        )
        for obj, children in rows
    ]
    return ListPage(items=items, total=total, page=page, page_size=page_size)


def branch_options(session: Session, user: AuthUser, *, ip: str | None) -> list[Branch]:
    require(session, user, "catalog.view", ip=ip)
    return repo.branch_options(session, user.branch_id if user.branch_scoped else None)


def get(session: Session, user: AuthUser, kind: str, object_id: uuid.UUID, *, ip: str | None) -> dict[str, Any]:
    spec = spec_of(kind)
    obj = common.load(session, spec, object_id)
    require(session, user, "catalog.view", obj, ip=ip)
    counts = {"children": repo.count_children(session, kind, obj.id)}
    if kind == "document":
        counts["files"] = repo.count_files(session, "document", obj.id)
    data = common.present(user, spec, obj, path=_path(kind, obj), counts=counts)
    if kind == "document":
        data["values"]["branch_id"] = common.to_json(document_branch_id(obj))
    return data


def create(session: Session, user: AuthUser, kind: str, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    spec = spec_of(kind)

    def scope(values: dict[str, Any]) -> Any:
        if kind == "fund":
            _check_branch(session, values.get("branch_id"))
            return Fund(branch_id=values.get("branch_id"))
        if kind == "inventory":
            return _get(session, Fund, values.get("fund_id"))
        if kind == "case":
            return _get(session, Inventory, values.get("inventory_id"))
        if values.get("case_id") is not None:
            return _get(session, Case, values["case_id"])
        _check_branch(session, values.get("branch_id"))
        return Document(branch_id=values.get("branch_id"))

    def prepare(values: dict[str, Any]) -> None:
        if kind == "document":
            case = session.get(Case, values["case_id"]) if values.get("case_id") else None
            # Hierarchy wins over any branch the client sent.
            values["branch_id"] = case.inventory.fund.branch_id if case else values.get("branch_id")

    obj = common.create(session, user, spec, body, scope=scope, prepare=prepare, ip=ip)
    return get(session, user, kind, obj.id, ip=ip)


def update(session: Session, user: AuthUser, kind: str, object_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    spec = spec_of(kind)

    def prepare(obj: Any, values: dict[str, Any]) -> None:
        if kind == "fund" and "branch_id" in values and values["branch_id"] != obj.branch_id:
            _check_branch(session, values["branch_id"])
            if repo.count_children(session, "fund", obj.id):
                raise Conflict("branch_locked")  # documents below would keep the old branch
            require(session, user, "catalog.edit", Fund(branch_id=values["branch_id"]), ip=ip)
        if kind == "document":
            if "case_id" in values and values["case_id"] != obj.case_id:
                case = session.get(Case, values["case_id"]) if values["case_id"] else None
                if values["case_id"] and case is None:
                    raise InvalidInput("unknown_parent")
                if case is not None:
                    require(session, user, "catalog.edit", case, ip=ip)
                obj.case = case
            if obj.case is not None:
                values.pop("branch_id", None)
            elif "branch_id" in values:
                _check_branch(session, values["branch_id"])
                require(session, user, "catalog.edit", Document(branch_id=values["branch_id"]), ip=ip)
                obj.branch_id = values["branch_id"]

    common.update(session, user, spec, object_id, body, ip=ip, prepare=prepare)
    return get(session, user, kind, object_id, ip=ip)


def delete(session: Session, user: AuthUser, kind: str, object_id: uuid.UUID, *, ip: str | None) -> None:
    spec = spec_of(kind)

    def blockers(obj: Any) -> str | None:
        if repo.count_children(session, kind, obj.id):
            return "has_children"
        if kind == "document" and repo.count_files(session, "document", obj.id):
            return "has_files"
        return None

    common.delete(session, user, spec, object_id, ip=ip, blockers=blockers)
