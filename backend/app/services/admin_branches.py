"""Admin CRUD of branches (T6.7). A branch admin works only with their own branch:
`authz.require("branches.edit", branch)` compares the branch of the object with theirs."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Branch
from app.models.enums import WorkflowStatus
from app.repositories import admin_catalog, admin_content as repo
from app.schemas.admin_content import BranchIn
from app.services import admin_common as common
from app.services.admin_common import Spec
from app.services.authz import AuthUser, require
from app.services.errors import Conflict, InvalidInput

SPEC = Spec("branch", Branch, BranchIn, "branches", text_required=("name",))


def search(
    session: Session, user: AuthUser, *, q: str | None, page: int, page_size: int, ip: str | None
) -> tuple[list[Branch], int]:
    require(session, user, "branches.view", ip=ip)
    return repo.search_branches(
        session, q=q, branch_id=user.branch_id if user.branch_scoped else None,
        offset=(page - 1) * page_size, limit=page_size,
    )


def get(session: Session, user: AuthUser, branch_id: uuid.UUID, *, ip: str | None) -> dict[str, Any]:
    branch = common.load(session, SPEC, branch_id)
    require(session, user, "branches.view", branch, ip=ip)
    return common.present(user, SPEC, branch, counts={"files": admin_catalog.count_files(session, "branch", branch.id)})


def _check_coords(values: dict[str, Any], current: Branch | None) -> None:
    lat = values["lat"] if "lat" in values else getattr(current, "lat", None)
    lng = values["lng"] if "lng" in values else getattr(current, "lng", None)
    if (lat is None) != (lng is None):
        raise InvalidInput("coords_incomplete")


def create(session: Session, user: AuthUser, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    def prepare(values: dict[str, Any]) -> None:
        _check_coords(values, None)
        if values.get("photo_file_id") is not None:
            raise InvalidInput("file_not_owned")  # attach the photo after the branch exists

    # A new branch has no id yet: branch-scoped users never match it, so only global roles may create.
    branch = common.create(session, user, SPEC, body, scope=lambda values: Branch(), prepare=prepare, ip=ip)
    return get(session, user, branch.id, ip=ip)


def update(session: Session, user: AuthUser, branch_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    def prepare(branch: Branch, values: dict[str, Any]) -> None:
        _check_coords(values, branch)
        if "slug" in values and values["slug"] != branch.slug and branch.workflow_status == WorkflowStatus.PUBLISHED:
            raise Conflict("slug_locked")  # a published address must not change
        photo = values.get("photo_file_id")
        if photo is not None and not repo.file_owned_by(session, photo, "branch", branch.id):
            raise InvalidInput("file_not_owned")

    common.update(session, user, SPEC, branch_id, body, ip=ip, prepare=prepare)
    return get(session, user, branch_id, ip=ip)


def delete(session: Session, user: AuthUser, branch_id: uuid.UUID, *, ip: str | None) -> None:
    def blockers(branch: Branch) -> str | None:
        if repo.branch_dependents(session, branch.id):
            return "has_children"
        return "has_files" if admin_catalog.count_files(session, "branch", branch.id) else None

    common.delete(session, user, SPEC, branch_id, ip=ip, blockers=blockers)
