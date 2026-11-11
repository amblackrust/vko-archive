import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Query, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.models.enums import WorkflowStatus
from app.repositories import admin_catalog as repo
from app.schemas.admin_common import ListItem, ListPage, ObjectOut
from app.services import admin_catalog as service
from app.services import indexing

router = APIRouter(prefix="/catalog", tags=["admin: catalog"])


@router.get("/branch-options")
def branch_options(user: CurrentUser, session: DbSession, ip: ClientIp) -> list[dict[str, Any]]:
    return [{"id": b.id, "name": b.name} for b in service.branch_options(session, user, ip=ip)]


@router.get("/{kind}", response_model=ListPage)
def list_objects(
    kind: str,
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    q: Annotated[str | None, Query(max_length=200)] = None,
    parent_id: uuid.UUID | None = None,
    workflow_status: WorkflowStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ListPage:
    rows, total = service.search(
        session, user, kind, q=q, parent_id=parent_id, status=workflow_status, page=page, page_size=page_size, ip=ip
    )
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


@router.post("/{kind}", response_model=ObjectOut, status_code=status.HTTP_201_CREATED)
def create_object(kind: str, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.create(session, user, kind, body, ip=ip)


@router.get("/{kind}/{object_id}", response_model=ObjectOut)
def get_object(kind: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.get(session, user, kind, object_id, ip=ip)


@router.patch("/{kind}/{object_id}", response_model=ObjectOut)
def update_object(
    kind: str, object_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp,
    background: BackgroundTasks,
) -> dict[str, Any]:
    result = service.update(session, user, kind, object_id, body, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return result


@router.delete("/{kind}/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_object(kind: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.delete(session, user, kind, object_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
