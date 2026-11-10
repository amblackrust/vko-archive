"""Public contracts of news and events (T5.14). Bodies are returned as sanitized HTML."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.exhibitions import MediaRef

Lang = Literal["kk", "ru", "en"]


class NewsParams(BaseModel):
    lang: Lang = "ru"
    category: str = Field(default="", max_length=64)
    q: str = Field(default="", max_length=200)
    sort: Literal["date_desc", "date_asc"] = "date_desc"
    page: int = Field(default=1, ge=1, le=1000)
    per_page: int = Field(default=9, ge=1, le=50)


class NewsItem(BaseModel):
    id: uuid.UUID
    slug: str
    href: str
    title: str
    title_lang: str
    summary: str
    category: str | None
    published_at: datetime | None
    cover: MediaRef | None
    is_demo: bool
    translation_status: str


class NewsList(BaseModel):
    total: int
    page: int
    pages: int
    items: list[NewsItem]
    categories: list[str]


class NewsMedia(BaseModel):
    file: MediaRef | None
    url: str | None  # external https link (video, etc.)


class RelatedRef(BaseModel):
    type: Literal["document", "exhibition", "news"]
    id: uuid.UUID
    title: str
    href: str


class NewsDetail(NewsItem):
    body: str  # sanitized HTML
    body_lang: str
    media: list[NewsMedia]
    related: list[RelatedRef]
