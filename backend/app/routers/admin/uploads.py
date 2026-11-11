import hashlib
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response, status
from fastapi.concurrency import run_in_threadpool

from app.deps import AppSettings, ClientIp, CurrentUser, DbSession
from app.schemas.admin_uploads import UploadedFile
from app.services import admin_uploads as service
from app.services import ai_tools
from app.services.errors import FileTooLarge, UnsupportedMedia

router = APIRouter(prefix="/uploads", tags=["admin: uploads"])


@router.post("", response_model=UploadedFile, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    background: BackgroundTasks,
    user: CurrentUser,
    session: DbSession,
    settings: AppSettings,
    ip: ClientIp,
    owner_type: Annotated[str, Query(max_length=32)],
    owner_id: uuid.UUID,
    filename: Annotated[str, Query(min_length=1, max_length=255)],
) -> UploadedFile:
    """The file is the raw request body (one file per request; the UI sends batches one by one)."""
    target = await run_in_threadpool(service.authorize_upload, session, user, owner_type, owner_id, filename, ip=ip)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > service.MAX_UPLOAD_BYTES:
        raise FileTooLarge()
    temp = service.tmp_path(settings)
    digest = hashlib.sha256()
    head = b""
    size = 0
    kind = None
    try:
        with temp.open("wb") as out:
            async for chunk in request.stream():
                if len(head) < service.SNIFF_BYTES:
                    head += chunk[: service.SNIFF_BYTES - len(head)]
                size += len(chunk)
                if size > service.MAX_UPLOAD_BYTES:
                    raise FileTooLarge()
                digest.update(chunk)
                out.write(chunk)
                if kind is None and len(head) >= service.SNIFF_BYTES:
                    kind = service.sniff(head)
                    if kind is None:
                        raise UnsupportedMedia()
                if kind is not None and size > service.LIMITS[kind.category]:
                    raise FileTooLarge()
        kind = kind or service.sniff(head)
        if kind is None:
            raise UnsupportedMedia()
        stored = await run_in_threadpool(
            service.store, session, settings, user, target, temp, size=size, sha256=digest.hexdigest(), kind=kind, ip=ip
        )
        if target.owner_type == "document" and kind.category in ("image", "pdf"):
            background.add_task(ai_tools.auto_ocr, session.get_bind(), settings, user, stored.id)
        return stored
    finally:
        temp.unlink(missing_ok=True)  # already moved on success


@router.get("", response_model=list[UploadedFile])
def list_files(
    user: CurrentUser, session: DbSession, ip: ClientIp, owner_type: Annotated[str, Query(max_length=32)], owner_id: uuid.UUID
) -> list[UploadedFile]:
    return service.list_files(session, user, owner_type, owner_id, ip=ip)


@router.patch("/{file_id}", response_model=UploadedFile)
def update_file(file_id: uuid.UUID, body: dict[str, Any], user: CurrentUser, session: DbSession, ip: ClientIp) -> UploadedFile:
    return service.update_file(session, user, file_id, body, ip=ip)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: uuid.UUID, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp) -> Response:
    service.delete_file(session, settings, user, file_id, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
