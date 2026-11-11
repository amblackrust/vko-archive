import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Query, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.schemas.admin_common import ListItem, ListPage, ObjectOut
from app.services import admin_exhibitions as service
from app.services import indexing

router = APIRouter(tags=["admin: exhibitions"])


@router.get("/exhibitions", response_model=ListPage)
def list_exhibitions(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ListPage:
    rows, total = service.search(session, user, q=q, page=page, page_size=page_size, ip=ip)
    items = [
        ListItem(
            id=e.id, kind="exhibition", number=e.slug, title=e.title, workflow_status=e.workflow_status.value,
            version=e.version, updated_at=e.updated_at, extra={"theme": e.theme, "is_demo": e.is_demo},
        )
        for e in rows
    ]
    return ListPage(items=items, total=total, page=page, page_size=page_size)


@router.post("/exhibitions", response_model=ObjectOut, status_code=status.HTTP_201_CREATED)
def create_exhibition(body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.create_exhibition(session, user, body, ip=ip)


@router.get("/exhibitions/{exhibition_id}", response_model=ObjectOut)
def get_exhibition(exhibition_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.get_exhibition(session, user, exhibition_id, ip=ip)


@router.patch("/exhibitions/{exhibition_id}", response_model=ObjectOut)
def update_exhibition(
    exhibition_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp,
    background: BackgroundTasks,
) -> dict[str, Any]:
    result = service.update_exhibition(session, user, exhibition_id, body, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return result


@router.delete("/exhibitions/{exhibition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exhibition(exhibition_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.delete_exhibition(session, user, exhibition_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/exhibitions/{exhibition_id}/exhibits", response_model=list[ObjectOut])
def list_exhibits(exhibition_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> list[dict[str, Any]]:
    return service.list_exhibits(session, user, exhibition_id, ip=ip)


@router.put("/exhibitions/{exhibition_id}/exhibits/order", response_model=list[ObjectOut])
def reorder_exhibits(
    exhibition_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp
) -> list[dict[str, Any]]:
    return service.reorder(session, user, exhibition_id, body, ip=ip)


@router.post("/exhibits", response_model=ObjectOut, status_code=status.HTTP_201_CREATED)
def create_exhibit(body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.create_exhibit(session, user, body, ip=ip)


@router.get("/exhibits/{exhibit_id}", response_model=ObjectOut)
def get_exhibit(exhibit_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.get_exhibit(session, user, exhibit_id, ip=ip)


@router.patch("/exhibits/{exhibit_id}", response_model=ObjectOut)
def update_exhibit(
    exhibit_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp,
    background: BackgroundTasks,
) -> dict[str, Any]:
    result = service.update_exhibit(session, user, exhibit_id, body, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return result


@router.delete("/exhibits/{exhibit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exhibit(exhibit_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.delete_exhibit(session, user, exhibit_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
