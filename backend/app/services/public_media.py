"""Open-file references for public pages (exhibitions, news). A file is offered only when
anonymous visitors may download it right now (`authorize(None, "file.download", ...)`), so
closed or restricted copies never leak through a cover or an exhibit."""

import uuid

from sqlalchemy.orm import Session

from app.repositories import files as files_repo
from app.schemas.exhibitions import MediaRef
from app.services import files as files_service
from app.services.authz import FILE_DOWNLOAD, authorize


def open_media(session: Session, file_id: uuid.UUID | None) -> MediaRef | None:
    if file_id is None:
        return None
    file = files_repo.get_file(session, file_id)
    if file is None or not authorize(None, FILE_DOWNLOAD, files_service.file_target(session, file)):
        return None
    return MediaRef(
        url=files_service.file_url(file.id),
        preview_url=files_service.file_url(file.id, "preview") if file.preview_path else None,
        mime=file.mime,
    )


def https_url(value: str | None) -> str | None:
    """External links are rendered as href: only http(s) is allowed."""
    return value if value and value.startswith(("https://", "http://")) else None
