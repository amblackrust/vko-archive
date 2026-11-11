"""Admin CRUD of exhibitions and exhibits (T6.8). Exhibits have their own workflow; their order
is changed by `reorder`, which saves each moved exhibit through save_with_version.
Exhibits link to documents/funds by id: the user must be able to view the linked catalog object."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Document, Exhibit, Exhibition, Fund
from app.models.enums import AuditResult, WorkflowStatus
from app.repositories import admin_catalog, admin_content as repo
from app.schemas.admin_content import ExhibitIn, ExhibitionIn, ExhibitOrder
from app.services import admin_common as common
from app.services import audit, workflow
from app.services.admin_common import Spec
from app.services.authz import AuthUser, require
from app.services.errors import Conflict, InvalidInput

EXHIBITION = Spec("exhibition", Exhibition, ExhibitionIn, "content", text_required=("title",))
EXHIBIT = Spec("exhibit", Exhibit, ExhibitIn, "content", text_required=("title",), create_only=frozenset({"exhibition_id"}))


def search(session: Session, user: AuthUser, *, q: str | None, page: int, page_size: int, ip: str | None) -> tuple[list[Exhibition], int]:
    require(session, user, "content.view", ip=ip)
    return repo.search_exhibitions(session, q=q, offset=(page - 1) * page_size, limit=page_size)


def get_exhibition(session: Session, user: AuthUser, exhibition_id: uuid.UUID, *, ip: str | None) -> dict[str, Any]:
    exhibition = common.load(session, EXHIBITION, exhibition_id)
    require(session, user, "content.view", exhibition, ip=ip)
    counts = {
        "exhibits": repo.count_exhibits(session, exhibition.id),
        "files": admin_catalog.count_files(session, "exhibition", exhibition.id),
    }
    return common.present(user, EXHIBITION, exhibition, counts=counts)


def get_exhibit(session: Session, user: AuthUser, exhibit_id: uuid.UUID, *, ip: str | None) -> dict[str, Any]:
    exhibit = common.load(session, EXHIBIT, exhibit_id)
    require(session, user, "content.view", exhibit, ip=ip)
    data = common.present(user, EXHIBIT, exhibit, counts={"files": admin_catalog.count_files(session, "exhibit", exhibit.id)})
    data["values"]["position"] = exhibit.position
    return data


def list_exhibits(session: Session, user: AuthUser, exhibition_id: uuid.UUID, *, ip: str | None) -> list[dict[str, Any]]:
    exhibition = common.load(session, EXHIBITION, exhibition_id)
    require(session, user, "content.view", exhibition, ip=ip)
    return [get_exhibit(session, user, e.id, ip=ip) for e in repo.exhibits_of(session, exhibition.id)]


def _check_links(session: Session, user: AuthUser, exhibit_id: uuid.UUID | None, values: dict[str, Any], ip: str | None) -> None:
    for key, model in (("document_id", Document), ("fund_id", Fund)):
        if values.get(key) is not None:
            linked = session.get(model, values[key])
            if linked is None:
                raise InvalidInput("unknown_link")
            require(session, user, "catalog.view", linked, ip=ip)
    media = values.get("media_file_id")
    if media is not None and (exhibit_id is None or not repo.file_owned_by(session, media, "exhibit", exhibit_id)):
        raise InvalidInput("file_not_owned")


def create_exhibition(session: Session, user: AuthUser, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    def prepare(values: dict[str, Any]) -> None:
        if values.get("cover_file_id") is not None:
            raise InvalidInput("file_not_owned")  # attach the cover after the exhibition exists

    obj = common.create(session, user, EXHIBITION, body, scope=lambda values: None, prepare=prepare, ip=ip)
    return get_exhibition(session, user, obj.id, ip=ip)


def update_exhibition(session: Session, user: AuthUser, exhibition_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    def prepare(obj: Exhibition, values: dict[str, Any]) -> None:
        if "slug" in values and values["slug"] != obj.slug and obj.workflow_status == WorkflowStatus.PUBLISHED:
            raise Conflict("slug_locked")
        cover = values.get("cover_file_id")
        if cover is not None and not repo.file_owned_by(session, cover, "exhibition", obj.id):
            raise InvalidInput("file_not_owned")

    common.update(session, user, EXHIBITION, exhibition_id, body, ip=ip, prepare=prepare)
    return get_exhibition(session, user, exhibition_id, ip=ip)


def delete_exhibition(session: Session, user: AuthUser, exhibition_id: uuid.UUID, *, ip: str | None) -> None:
    def blockers(obj: Exhibition) -> str | None:
        if repo.count_exhibits(session, obj.id):
            return "has_children"
        return "has_files" if admin_catalog.count_files(session, "exhibition", obj.id) else None

    common.delete(session, user, EXHIBITION, exhibition_id, ip=ip, blockers=blockers)


def create_exhibit(session: Session, user: AuthUser, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    def scope(values: dict[str, Any]) -> Any:
        parent = session.get(Exhibition, values.get("exhibition_id"))
        if parent is None:
            raise InvalidInput("unknown_parent")
        return parent

    def prepare(values: dict[str, Any]) -> None:
        _check_links(session, user, None, values, ip)
        values["position"] = repo.next_exhibit_position(session, values["exhibition_id"])

    obj = common.create(session, user, EXHIBIT, body, scope=scope, prepare=prepare, ip=ip)
    return get_exhibit(session, user, obj.id, ip=ip)


def update_exhibit(session: Session, user: AuthUser, exhibit_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    common.update(
        session, user, EXHIBIT, exhibit_id, body, ip=ip,
        prepare=lambda obj, values: _check_links(session, user, obj.id, values, ip),
    )
    return get_exhibit(session, user, exhibit_id, ip=ip)


def delete_exhibit(session: Session, user: AuthUser, exhibit_id: uuid.UUID, *, ip: str | None) -> None:
    common.delete(
        session, user, EXHIBIT, exhibit_id, ip=ip,
        blockers=lambda obj: "has_files" if admin_catalog.count_files(session, "exhibit", obj.id) else None,
    )


def reorder(session: Session, user: AuthUser, exhibition_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> list[dict[str, Any]]:
    """New order = the given ids (must be exactly the exhibition's exhibits)."""
    exhibition = common.load(session, EXHIBITION, exhibition_id)
    require(session, user, "content.edit", exhibition, ip=ip)
    ids = common.parse(ExhibitOrder, body).get("ids")
    exhibits = {e.id: e for e in repo.exhibits_of(session, exhibition_id)}
    if ids is None or len(ids) != len(set(ids)) or set(ids) != set(exhibits):
        raise InvalidInput("invalid_order")
    for position, ident in enumerate(ids):
        exhibit = exhibits[ident]
        if exhibit.position != position:
            workflow.save_with_version(session, user, "exhibit", exhibit, exhibit.version, {"position": position})
    audit.record(
        session, action_type="exhibit.reorder", result=AuditResult.SUCCESS, user=user,
        object_type="exhibition", object_id=exhibition_id, details={"count": len(ids)}, ip=ip,
    )
    session.commit()
    return list_exhibits(session, user, exhibition_id, ip=ip)
