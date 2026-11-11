import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import FileAccess
from app.schemas.admin_common import I18nText, StrictInput


class UploadedFile(BaseModel):
    """A stored file as the admin UI sees it: ids and /api/files URLs, never storage paths."""

    id: uuid.UUID
    owner_type: str | None
    owner_id: uuid.UUID | None
    position: int
    original_name: str | None
    mime: str
    size: int
    pages: int | None
    access: FileAccess
    caption: dict[str, str]
    url: str
    preview_url: str | None
    created_at: datetime


class FilePatch(StrictInput):
    access: FileAccess | None = None
    position: int | None = Field(default=None, ge=0, le=100_000)
    caption: I18nText | None = None
