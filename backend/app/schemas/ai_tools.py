"""Contracts of the staff AI tools (T4.9, T4.10). Every AI result is a proposal."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Lang = Literal["kk", "ru", "en"]


class AiToolsStatus(BaseModel):
    ai_available: bool
    reason: str | None = None
    ocr_engine: Literal["tesseract", "vision"] | None = None  # None: OCR is unavailable


class AiUnavailableOut(BaseModel):
    detail: str
    reason: str


class AnalyzeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lang: Lang = "ru"


class TagSuggestion(BaseModel):
    id: uuid.UUID
    name: str


class DocumentRef(BaseModel):
    id: uuid.UUID
    title: str
    archive_code: str | None
    workflow_status: str


class DuplicateRef(DocumentRef):
    reason: Literal["same_file", "similar"]
    distance: float | None = None  # similar: cosine distance, smaller = closer


class RelatedRef(BaseModel):
    id: uuid.UUID
    title: str
    href: str


class AnalysisOut(BaseModel):
    document_id: uuid.UUID
    version: int
    lang: Lang
    text_chars: int  # how much document text the model saw (0: only the description)
    dates: list[str]
    persons: list[str]
    organizations: list[str]
    places: list[str]
    events: list[str]
    topics: list[str]
    tags: list[TagSuggestion]
    summary: str
    related: list[RelatedRef]
    duplicates: list[DuplicateRef]
    label: str


class ApplyIn(BaseModel):
    """Fields the employee accepted. Absent field = not applied."""

    model_config = ConfigDict(extra="forbid")

    version: int
    lang: Lang = "ru"
    summary: str | None = Field(default=None, max_length=2000)
    authors: str | None = Field(default=None, max_length=500)
    date_text: str | None = Field(default=None, max_length=255)
    places: list[str] | None = Field(default=None, max_length=20)
    tag_ids: list[uuid.UUID] | None = Field(default=None, max_length=30)


class ApplyOut(BaseModel):
    version: int
    applied: list[str]


class OcrProposal(BaseModel):
    file_id: uuid.UUID
    status: Literal["done", "failed", "unavailable"]
    engine: str | None = None
    reason: str | None = None
    text: str = ""


class OcrApplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=500_000)


class OcrApplyOut(BaseModel):
    file_id: uuid.UUID
    ocr_status: str


class AnnotationOut(BaseModel):
    lang: Lang
    text: str
    status: Literal["draft", "approved"]
    uses_file_text: bool
    updated_at: datetime
    approved_at: datetime | None
    label: str


class AnnotationGenerateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lang: Lang = "ru"


class AnnotationEditIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=2000)


class CollectionDraftIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3, max_length=200)
    lang: Lang = "ru"
    limit: int = Field(default=8, ge=2, le=20)


class CollectionDraftOut(BaseModel):
    title: str
    description: str
    items: list[RelatedRef]
    label: str
