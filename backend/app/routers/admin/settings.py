import uuid
from typing import Any

from fastapi import APIRouter, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.services import admin_settings as service

router = APIRouter(tags=["admin: settings"])


@router.get("/settings")
def list_settings(user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.list_settings(session, user, ip=ip)


@router.put("/settings/{key}")
def put_setting(key: str, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.put_setting(session, user, key, body, ip=ip)


@router.get("/synonyms")
def list_synonyms(user: CurrentUser, session: DbSession, ip: ClientIp) -> list[dict[str, Any]]:
    return service.list_synonyms(session, user, ip=ip)


@router.post("/synonyms", status_code=status.HTTP_201_CREATED)
def create_synonym(body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.create_synonym(session, user, body, ip=ip)


@router.patch("/synonyms/{synonym_id}")
def update_synonym(synonym_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> dict[str, Any]:
    return service.update_synonym(session, user, synonym_id, body, ip=ip)


@router.delete("/synonyms/{synonym_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_synonym(synonym_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.delete_synonym(session, user, synonym_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
