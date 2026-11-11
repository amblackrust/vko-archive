import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.schemas.admin_common import ListItem, ListPage, ObjectOut
from app.services import admin_content as service
from app.services import indexing

CONTENT_KINDS = ("news", "page", "faq", "legal_act", "price_list_item", "memorial_date")


def crud_router(prefix: str, names: tuple[str, ...], tag: str) -> APIRouter:
    """List / create / read / update / delete of CMS objects of the given kinds."""
    router = APIRouter(prefix=prefix, tags=[tag])

    def known(kind: str) -> str:
        if kind not in names:
            raise HTTPException(status_code=404, detail="not_found")
        return kind

    @router.get("/{kind}", response_model=ListPage)
    def list_objects(
        kind: str, user: CurrentUser, session: DbSession, ip: ClientIp,
        q: Annotated[str | None, Query(max_length=200)] = None,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> ListPage:
        entry = service.kind_of(known(kind))
        rows, total = service.search(session, user, kind, q=q, page=page, page_size=page_size, ip=ip)
        items = [
            ListItem(
                id=o.id, kind=kind, number=entry.number(o), title=entry.title(o), workflow_status=o.workflow_status.value,
                version=o.version, updated_at=o.updated_at, extra=entry.extra(o),
            )
            for o in rows
        ]
        return ListPage(items=items, total=total, page=page, page_size=page_size)

    @router.post("/{kind}", response_model=ObjectOut, status_code=status.HTTP_201_CREATED)
    def create_object(kind: str, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
        return service.create(session, user, known(kind), body, ip=ip)

    @router.get("/{kind}/{object_id}", response_model=ObjectOut)
    def get_object(kind: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
        return service.get(session, user, known(kind), object_id, ip=ip)

    @router.patch("/{kind}/{object_id}", response_model=ObjectOut)
    def update_object(
        kind: str, object_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp,
        background: BackgroundTasks,
    ) -> dict[str, Any]:
        result = service.update(session, user, known(kind), object_id, body, ip=ip)
        background.add_task(indexing.embed_pending_background, session.get_bind())
        return result

    @router.delete("/{kind}/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_object(kind: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
        service.delete(session, user, known(kind), object_id, ip=ip)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


router = crud_router("/content", CONTENT_KINDS, "admin: content")
