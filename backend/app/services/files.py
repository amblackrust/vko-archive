"""File delivery (T3.7): the only way to get a stored file is GET /api/files/{id}.

Rule (docs/DECISIONS.md п.14, B12 `authz` "file.download"): the file's own access AND,
for document files, the document (published, description public, file_access open) must
allow it; staff with files.view see restricted/closed files within their branch. Any
refusal — missing file, missing owner, no rights, needs_review — is 404. Storage paths
never leave the server: responses carry only file ids and /api/files URLs.
"""

import logging
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    Branch,
    Collection,
    DigitalFile,
    Document,
    Exhibit,
    Exhibition,
    HistoricalEvent,
    LegalAct,
    News,
    Page,
    Person,
)
from app.models.enums import WorkflowStatus
from app.repositories import files as files_repo
from app.services.authz import FILE_DOWNLOAD, AuthUser, FileTarget, authorize, require
from app.services.errors import NotFound

logger = logging.getLogger(__name__)

Variant = Literal["master", "preview"]

# Non-document owners: a file is public only while its owner is published.
OWNER_MODELS: dict[str, type] = {
    "exhibit": Exhibit,
    "exhibition": Exhibition,
    "news": News,
    "person": Person,
    "branch": Branch,
    "page": Page,
    "legal_act": LegalAct,
    "collection": Collection,
    "historical_event": HistoricalEvent,
}

# Only passive formats are shown inline (allowlist); anything else — HTML, SVG, XML,
# unknown types — is a download, so stored files can never run script on our origin.
_INLINE_MIME = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"})
_INLINE_MIME_PREFIXES = ("audio/", "video/")


def normalize_mime(mime: str | None) -> str:
    """Bare lower-case media type: "TEXT/HTML; charset=utf-8" -> "text/html"."""
    return (mime or "").split(";")[0].strip().lower() or "application/octet-stream"


def is_inline_mime(mime: str) -> bool:
    return mime in _INLINE_MIME or mime.startswith(_INLINE_MIME_PREFIXES)


@dataclass(frozen=True)
class FileDownload:
    path: Path
    mime: str
    filename: str | None
    public: bool  # also visible to anonymous visitors (cacheable)
    attachment: bool  # force download (not an allowlisted passive format)


@dataclass(frozen=True)
class FileRef:
    """A file as public API responses may show it: id and URLs, never storage paths."""

    id: uuid.UUID
    position: int
    mime: str
    pages: int | None
    url: str
    preview_url: str | None


def file_url(file_id: uuid.UUID, variant: Variant = "master") -> str:
    return f"/api/files/{file_id}" + ("?variant=preview" if variant == "preview" else "")


def file_target(session: Session, file: DigitalFile, document: Document | None = None) -> FileTarget:
    """Loads the owner for the "file.download" check."""
    if file.owner_type == "document":
        if document is None and file.owner_id is not None:
            document = files_repo.get_owner(session, Document, file.owner_id)
        return FileTarget(file, document=document)
    model = OWNER_MODELS.get(file.owner_type or "")
    owner = files_repo.get_owner(session, model, file.owner_id) if model and file.owner_id else None
    return FileTarget(file, owner_published=owner is not None and owner.workflow_status == WorkflowStatus.PUBLISHED)


def _resolve(storage_dir: Path, relative: str) -> Path | None:
    base = storage_dir.resolve()
    path = (base / relative).resolve()
    if not path.is_relative_to(base) or not path.is_file():
        return None
    return path


def get_download(
    session: Session, settings: Settings, user: AuthUser | None, file_id: uuid.UUID, variant: Variant, *, ip: str | None
) -> FileDownload:
    file = files_repo.get_file(session, file_id)
    if file is None:
        raise NotFound()
    target = file_target(session, file)
    require(session, user, FILE_DOWNLOAD, target, ip=ip)
    relative = file.preview_path if variant == "preview" else file.master_path
    if not relative:
        raise NotFound()
    path = _resolve(settings.storage_dir, relative)
    if path is None:
        # A DB row pointing outside storage or to a missing file: an operator problem.
        logger.error("file %s (%s) is missing or outside the storage dir", file.id, variant)
        raise NotFound()
    mime = normalize_mime(file.mime if variant == "master" else mimetypes.guess_type(path.name)[0])
    return FileDownload(
        path=path,
        mime=mime,
        filename=file.original_name if variant == "master" else None,
        public=authorize(None, FILE_DOWNLOAD, target),
        attachment=not is_inline_mime(mime),
    )


def visible_files(session: Session, user: AuthUser | None, document: Document) -> list[FileRef]:
    """Files of a document this user may open (for cards/viewers, B07). Empty for
    closed/restricted/unreviewed documents unless staff rights allow."""
    refs: list[FileRef] = []
    for file in files_repo.files_of_owner(session, "document", document.id):
        if not authorize(user, FILE_DOWNLOAD, file_target(session, file, document)):
            continue
        refs.append(
            FileRef(
                id=file.id,
                position=file.position,
                mime=file.mime,
                pages=file.pages,
                url=file_url(file.id),
                preview_url=file_url(file.id, "preview") if file.preview_path else None,
            )
        )
    return refs
