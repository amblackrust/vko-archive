import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.search import DocumentMeta, Lang, ObjectType

# Types that have a public page with a «similar materials» block.
SourceType = Literal["document", "exhibition", "collection", "news", "fund"]


class RecommendationParams(BaseModel):
    """`GET /api/ai/recommendations`. `seen` — recently viewed document ids, kept only in the
    visitor's browser and sent only while «personal recommendations» is on."""

    type: SourceType
    id: uuid.UUID
    lang: Lang = "ru"
    types: list[ObjectType] = Field(default_factory=list, max_length=7)  # default: the source type
    seen: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    limit: int = Field(default=6, ge=1, le=12)


class RecommendationItem(BaseModel):
    """`title` and `summary` are plain text; `href` is a site path without the locale."""

    type: ObjectType
    id: uuid.UUID
    title: str
    title_lang: Lang
    href: str
    summary: str = ""
    document: DocumentMeta | None = None


class RecommendationsResponse(BaseModel):
    # vector: by embeddings; fallback: no vectors (Ollama was unavailable) — tags/fund/title words.
    method: Literal["vector", "fallback"]
    personal: bool  # the history in `seen` was used
    items: list[RecommendationItem]
