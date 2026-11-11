import uuid
from typing import Any

from fastapi import APIRouter

from app.deps import ClientIp, CurrentUser, DbSession
from app.routers.admin.content import crud_router
from app.schemas.admin_common import ObjectOut
from app.services import admin_memory as service

MEMORY_KINDS = ("collection", "person", "historical_event")

router = APIRouter()
# Specific routes first: they must not be shadowed by the generic /{kind}/{id}.
extras = APIRouter(prefix="/memory", tags=["admin: memory"])


@extras.put("/collection/{collection_id}/items", response_model=ObjectOut)
def set_collection_items(collection_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.set_items(session, user, collection_id, body, ip=ip)


@extras.put("/{kind}/{object_id}/documents", response_model=ObjectOut)
def set_documents(kind: str, object_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.set_documents(session, user, kind, object_id, body, ip=ip)


router.include_router(extras)
router.include_router(crud_router("/memory", MEMORY_KINDS, "admin: memory"))
