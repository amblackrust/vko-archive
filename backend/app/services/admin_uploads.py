"""File upload for catalog documents, exhibits, exhibitions and branches (T6.5).

The type is decided by the file's signature (magic bytes), never by the client's
Content-Type; the extension must agree with it. Size limits depend on the type. The master
is stored unchanged under storage/masters/uploads/ (not a static directory), images get a
WebP preview. Every new file is `needs_review`: it is invisible to the public until someone
sets its access explicitly. Storage paths never leave the server.
"""

import hashlib
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Branch, Collection, DigitalFile, Document, Exhibit, Exhibition, LegalAct, News, Person
from app.models.enums import AuditResult, FileAccess
from app.repositories import files as files_repo
from app.schemas.admin_uploads import FilePatch, UploadedFile
from app.services import admin_common as common
from app.services import audit, indexing, workflow
from app.services.authz import AuthUser, require
from app.services.errors import FileTooLarge, InvalidInput, NotFound, UnsupportedMedia as UnsupportedFile
from app.services.files import file_url

logger = logging.getLogger(__name__)

MB = 1024 * 1024
SNIFF_BYTES = 32
PREVIEW_PIXELS = 1600
MAX_IMAGE_PIXELS = 100_000_000

# owner_type -> (model, permission module)
OWNERS: dict[str, tuple[type, str]] = {
    "document": (Document, "catalog"),
    "exhibit": (Exhibit, "content"),
    "exhibition": (Exhibition, "content"),
    "branch": (Branch, "branches"),
    "news": (News, "content"),
    "person": (Person, "content"),
    "collection": (Collection, "content"),
    "legal_act": (LegalAct, "content"),
}


@dataclass(frozen=True)
class Kind:
    mime: str
    extensions: frozenset[str]
    category: str  # image / pdf / audio / video


LIMITS = {"image": 100 * MB, "pdf": 200 * MB, "audio": 300 * MB, "video": 1024 * MB}
MAX_UPLOAD_BYTES = max(LIMITS.values())


def sniff(head: bytes) -> Kind | None:
    """File type by signature; None for anything outside the allowlist."""
    if head.startswith(b"%PDF-"):
        return Kind("application/pdf", frozenset({".pdf"}), "pdf")
    if head.startswith(b"\xff\xd8\xff"):
        return Kind("image/jpeg", frozenset({".jpg", ".jpeg"}), "image")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return Kind("image/png", frozenset({".png"}), "image")
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return Kind("image/tiff", frozenset({".tif", ".tiff"}), "image")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return Kind("image/webp", frozenset({".webp"}), "image")
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return Kind("audio/wav", frozenset({".wav"}), "audio")
    if head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return Kind("audio/mpeg", frozenset({".mp3"}), "audio")
    if head.startswith(b"OggS"):
        return Kind("audio/ogg", frozenset({".ogg", ".oga"}), "audio")
    if head.startswith(b"fLaC"):
        return Kind("audio/flac", frozenset({".flac"}), "audio")
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"M4A ", b"M4B "):
            return Kind("audio/mp4", frozenset({".m4a"}), "audio")
        if brand == b"qt  ":
            return Kind("video/quicktime", frozenset({".mov"}), "video")
        return Kind("video/mp4", frozenset({".mp4", ".m4v"}), "video")
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return Kind("video/webm", frozenset({".webm"}), "video")
    return None


def safe_name(filename: str) -> str:
    name = Path(filename.replace("\\", "/")).name
    return "".join(ch for ch in name if ch.isprintable())[:255].strip()


@dataclass(frozen=True)
class UploadTarget:
    owner_type: str
    owner_id: uuid.UUID
    filename: str
    extension: str


def authorize_upload(
    session: Session, user: AuthUser, owner_type: str, owner_id: uuid.UUID, filename: str, *, ip: str | None
) -> UploadTarget:
    """Rights and filename check before a single byte of the body is read."""
    entry = OWNERS.get(owner_type)
    if entry is None:
        raise InvalidInput("unknown_owner")
    model, module = entry
    owner = session.get(model, owner_id)
    if owner is None:
        raise NotFound()
    require(session, user, "files.upload", owner, ip=ip)
    require(session, user, f"{module}.edit", owner, ip=ip)
    name = safe_name(filename)
    extension = Path(name).suffix.lower()
    if not name or not extension:
        raise UnsupportedFile()
    return UploadTarget(owner_type, owner_id, name, extension)


def tmp_path(settings: Settings) -> Path:
    directory = settings.storage_dir / "tmp"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{uuid.uuid4().hex}.part"


def _make_preview(source: Path, target: Path) -> int | None:
    """WebP preview for images; returns the page/frame count. Raises InvalidInput for broken images."""
    try:
        with Image.open(source) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise InvalidInput("image_too_large")
            frames = getattr(image, "n_frames", 1)
            image.seek(0)
            preview = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
            preview.thumbnail((PREVIEW_PIXELS, PREVIEW_PIXELS))
            target.parent.mkdir(parents=True, exist_ok=True)
            preview.save(target, "WEBP", quality=80)
            return frames
    except InvalidInput:
        raise
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise InvalidInput("invalid_file") from exc


def _count_pdf_pages(source: Path) -> int:
    try:
        return len(PdfReader(source, strict=False).pages)
    except Exception as exc:  # pypdf raises many error types for damaged files
        raise InvalidInput("invalid_file") from exc


def store(
    session: Session,
    settings: Settings,
    user: AuthUser,
    target: UploadTarget,
    temp: Path,
    *,
    size: int,
    sha256: str,
    kind: Kind,
    ip: str | None,
) -> UploadedFile:
    """Moves the received temp file into storage and registers it (access = needs_review)."""
    if target.extension not in kind.extensions:
        raise UnsupportedFile()
    if size > LIMITS[kind.category] or size == 0:
        raise FileTooLarge() if size else InvalidInput("invalid_file")
    file_id = uuid.uuid4()
    master_rel = f"masters/uploads/{datetime.now(UTC):%Y}/{file_id.hex}{target.extension}"
    master = settings.storage_dir / master_rel
    preview_rel: str | None = None
    pages: int | None = None
    if kind.category == "image":
        preview_rel = f"previews/uploads/{file_id.hex}.webp"
        pages = _make_preview(temp, settings.storage_dir / preview_rel)
    elif kind.category == "pdf":
        pages = _count_pdf_pages(temp)
    master.parent.mkdir(parents=True, exist_ok=True)
    os.replace(temp, master)
    try:
        position = len(files_repo.files_of_owner(session, target.owner_type, target.owner_id))
        file = DigitalFile(
            id=file_id, owner_type=target.owner_type, owner_id=target.owner_id, position=position,
            original_name=target.filename, master_path=master_rel, preview_path=preview_rel, mime=kind.mime,
            size=size, sha256=sha256, pages=pages, uploaded_by=user.id, access=FileAccess.NEEDS_REVIEW,
        )
        session.add(file)
        if target.owner_type == "document":
            # Derived flag: set directly so an open editor form does not hit a version conflict.
            # A live document's card changes only once a file is opened (update_file), not on upload.
            document = session.get(Document, target.owner_id)
            if document.workflow_status not in workflow.LIVE_STATUSES:
                document.has_digital_copy = True
        audit.record(
            session, action_type="file.upload", result=AuditResult.SUCCESS, user=user, object_type="file",
            object_id=file_id, details={"owner": target.owner_type, "owner_id": target.owner_id, "mime": kind.mime, "size": size},
            ip=ip,
        )
        session.commit()
    except Exception:
        session.rollback()
        _unlink(settings, master_rel, preview_rel)
        raise
    return present(file)


def _unlink(settings: Settings, *relative: str | None) -> None:
    base = settings.storage_dir.resolve()
    for rel in relative:
        if not rel:
            continue
        path = (base / rel).resolve()
        if path.is_relative_to(base):
            path.unlink(missing_ok=True)


def present(file: DigitalFile) -> UploadedFile:
    return UploadedFile(
        id=file.id, owner_type=file.owner_type, owner_id=file.owner_id, position=file.position,
        original_name=file.original_name, mime=file.mime, size=file.size, pages=file.pages, access=file.access,
        caption=file.caption or {}, url=file_url(file.id),
        preview_url=file_url(file.id, "preview") if file.preview_path else None, created_at=file.created_at,
    )


def _owner(session: Session, user: AuthUser, owner_type: str, owner_id: uuid.UUID) -> tuple[Any, str]:
    entry = OWNERS.get(owner_type)
    if entry is None:
        raise InvalidInput("unknown_owner")
    owner = session.get(entry[0], owner_id)
    if owner is None:
        raise NotFound()
    return owner, entry[1]


def list_files(session: Session, user: AuthUser, owner_type: str, owner_id: uuid.UUID, *, ip: str | None) -> list[UploadedFile]:
    owner, module = _owner(session, user, owner_type, owner_id)
    require(session, user, "files.view", owner, ip=ip)
    require(session, user, f"{module}.view", owner, ip=ip)
    return [present(f) for f in files_repo.files_of_owner(session, owner_type, owner_id)]


def _load_file(session: Session, user: AuthUser, file_id: uuid.UUID, permission: str, module_action: str, ip: str | None) -> tuple[DigitalFile, Any]:
    file = files_repo.get_file(session, file_id)
    if file is None or file.owner_type not in OWNERS or file.owner_id is None:
        raise NotFound()
    owner, module = _owner(session, user, file.owner_type, file.owner_id)
    require(session, user, permission, owner, ip=ip)
    require(session, user, f"{module}.{module_action}", owner, ip=ip)
    return file, owner


def update_file(session: Session, user: AuthUser, file_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> UploadedFile:
    file, owner = _load_file(session, user, file_id, "files.upload", "edit", ip)
    values = common.parse(FilePatch, body)
    if any(v is None for v in values.values()):
        raise InvalidInput("invalid_input")
    # Access, order and captions of a live object's files are public content; closing is always allowed.
    changed = {name: value for name, value in values.items() if getattr(file, name) != value}
    if changed:
        workflow.require_live_edit(session, user, owner, ip=ip, values=changed)
    for name, value in values.items():
        setattr(file, name, value)
    if isinstance(owner, Document) and file.access == FileAccess.OPEN:
        owner.has_digital_copy = True
    audit.record(
        session, action_type="file.update", result=AuditResult.SUCCESS, user=user, object_type="file",
        object_id=file.id, details={"fields": sorted(values), "access": values.get("access")}, ip=ip,
    )
    # OCR text of this file is indexed only while an anonymous visitor may download it.
    indexing.reindex_file_owner(session, file.owner_type, file.owner_id)
    session.commit()
    return present(file)


def delete_file(session: Session, settings: Settings, user: AuthUser, file_id: uuid.UUID, *, ip: str | None) -> None:
    file, owner = _load_file(session, user, file_id, "files.delete", "edit", ip)
    workflow.require_live_edit(session, user, owner, ip=ip)
    owner_type, owner_id = file.owner_type, file.owner_id
    master, preview = file.master_path, file.preview_path
    session.delete(file)
    session.flush()
    if owner_type == "document":
        remaining = session.scalar(
            select(DigitalFile.id).where(DigitalFile.owner_type == "document", DigitalFile.owner_id == owner_id).limit(1)
        )
        session.get(Document, owner_id).has_digital_copy = remaining is not None
    audit.record(
        session, action_type="file.delete", result=AuditResult.SUCCESS, user=user, object_type="file",
        object_id=file_id, details={"owner": owner_type, "owner_id": owner_id}, ip=ip,
    )
    indexing.reindex_file_owner(session, owner_type, owner_id)
    session.commit()
    _unlink(settings, master, preview)
