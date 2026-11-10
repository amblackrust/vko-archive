"""Public contracts of online exhibitions (T5.13). All texts are plain text; `lang` fields name
the language actually returned (fallback order from services.catalog.pick)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["kk", "ru", "en"]


class ExhibitionParams(BaseModel):
    lang: Lang = "ru"
    theme: str = Field(default="", max_length=128)
    period: str = Field(default="", max_length=64)
    q: str = Field(default="", max_length=200)


class MediaRef(BaseModel):
    """An open file: only /api/files routes, never storage paths."""

    url: str
    preview_url: str | None
    mime: str


class ExhibitionItem(BaseModel):
    id: uuid.UUID
    slug: str
    href: str
    title: str
    title_lang: str
    theme: str | None
    period: str | None
    intro: str
    cover: MediaRef | None
    exhibits_count: int
    is_demo: bool
    translation_status: str


class ExhibitionList(BaseModel):
    total: int
    items: list[ExhibitionItem]
    themes: list[str]
    periods: list[str]


class Exhibit(BaseModel):
    id: uuid.UUID
    position: int  # 1-based order inside the exhibition
    title: str
    caption: str
    source: str
    archive_code: str | None
    media: MediaRef | None
    video_url: str | None  # external https link
    document_href: str | None  # catalog card, only when the document is public
    is_demo: bool


class ExhibitionDetail(ExhibitionItem):
    exhibits: list[Exhibit]
