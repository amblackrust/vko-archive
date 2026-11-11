import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Query, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.schemas.admin_common import ListItem, ListPage, ObjectOut
from app.services import admin_branches as service
from app.services import indexing

router = APIRouter(prefix="/branches", tags=["admin: branches"])


@router.get("", response_model=ListPage)
def list_branches(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ListPage:
    rows, total = service.search(session, user, q=q, page=page, page_size=page_size, ip=ip)
    items = [
        ListItem(
            id=b.id, kind="branch", number=b.slug, title=b.name, workflow_status=b.workflow_status.value,
            version=b.version, updated_at=b.updated_at, extra={"show_on_map": b.show_on_map, "type": b.type.value},
        )
        for b in rows
    ]
    return ListPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ObjectOut, status_code=status.HTTP_201_CREATED)
def create_branch(body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.create(session, user, body, ip=ip)


@router.get("/{branch_id}", response_model=ObjectOut)
def get_branch(branch_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.get(session, user, branch_id, ip=ip)


@router.patch("/{branch_id}", response_model=ObjectOut)
def update_branch(
    branch_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp,
    background: BackgroundTasks,
) -> dict[str, Any]:
    result = service.update(session, user, branch_id, body, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return result


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.delete(session, user, branch_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
