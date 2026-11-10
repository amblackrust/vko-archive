"""Public contracts of legal acts (T5.6) and the compliance page (T5.7). Titles are plain text."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import LegalActStatus

Lang = Literal["kk", "ru", "en"]


class LegalActParams(BaseModel):
    """Query of `GET /api/legal-acts`."""

    lang: Lang = "ru"
    q: str = Field(default="", max_length=200)  # title, number, issuer in any language
    status: LegalActStatus | None = None


class ActFile(BaseModel):
    """Only open files are listed; `url` is the /api/files route, never a storage path."""

    url: str
    mime: str
    pages: int | None


class LegalActItem(BaseModel):
    id: uuid.UUID
    title: str
    title_lang: str
    number: str | None
    date: date | None
    issuer: str
    status: LegalActStatus
    actualized_at: date | None
    adilet_url: str | None
    file: ActFile | None


class LegalActsResponse(BaseModel):
    total: int
    items: list[LegalActItem]


class CompliancePage(BaseModel):
    title: str
    title_lang: str
    body: str  # sanitized HTML from the page record
    body_lang: str
    officer: str | None
    documents: list[LegalActItem]
