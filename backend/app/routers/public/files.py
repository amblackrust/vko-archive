import os
import uuid

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import FileResponse

from app.deps import AppSettings, ClientIp, DbSession, OptionalUser
from app.services import files as files_service

router = APIRouter(tags=["files"])


def _etag_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    return if_none_match.strip() == "*" or etag in [t.strip().removeprefix("W/") for t in if_none_match.split(",")]


@router.get("/files/{file_id}", response_class=FileResponse)
def download_file(
    file_id: uuid.UUID,
    request: Request,
    session: DbSession,
    settings: AppSettings,
    user: OptionalUser,
    ip: ClientIp,
    variant: files_service.Variant = Query(default="master"),
) -> Response:
    """The only way to fetch a stored file. Hidden or missing → 404 (never 403)."""
    download = files_service.get_download(session, settings, user, file_id, variant, ip=ip)
    headers = {
        "X-Content-Type-Options": "nosniff",
        # Public files: caches revalidate every time (ETag → 304), so closing a file takes
        # effect at once. Files served thanks to staff rights never land in any cache.
        "Cache-Control": "public, no-cache" if download.public else "private, no-store",
        # A stored file is never an active document of our origin, whatever its type.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    }
    response = FileResponse(
        download.path,
        media_type=download.mime,
        filename=download.filename or str(file_id),
        content_disposition_type="attachment" if download.attachment else "inline",
        headers=headers,
        stat_result=os.stat(download.path),
    )
    # Revalidation after the access check above: a closed file answers 404, not 304.
    if download.public and _etag_matches(request.headers.get("if-none-match"), response.headers["etag"]):
        return Response(status_code=304, headers={**headers, "ETag": response.headers["etag"]})
    return response
