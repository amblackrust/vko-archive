import uuid

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from app.deps import AppSettings, ClientIp, DbSession, OptionalUser
from app.services import files as files_service

router = APIRouter(tags=["files"])


@router.get("/files/{file_id}", response_class=FileResponse)
def download_file(
    file_id: uuid.UUID,
    session: DbSession,
    settings: AppSettings,
    user: OptionalUser,
    ip: ClientIp,
    variant: files_service.Variant = Query(default="master"),
) -> FileResponse:
    """The only way to fetch a stored file. Hidden or missing → 404 (never 403)."""
    download = files_service.get_download(session, settings, user, file_id, variant, ip=ip)
    headers = {
        "X-Content-Type-Options": "nosniff",
        # Files served thanks to staff rights must not land in shared caches.
        "Cache-Control": "public, max-age=3600" if download.public else "private, no-store",
    }
    if download.attachment:
        headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return FileResponse(
        download.path,
        media_type=download.mime,
        filename=download.filename or str(file_id),
        content_disposition_type="attachment" if download.attachment else "inline",
        headers=headers,
    )
