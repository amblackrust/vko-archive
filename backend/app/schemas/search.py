import uuid
from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["kk", "ru", "en"]
ObjectType = Literal["document", "fund", "page", "branch", "exhibition", "collection", "news"]


class SearchFilters(BaseModel):
    q: str = Field(default="", max_length=500)
    lang: Lang = "ru"
    types: list[ObjectType] = Field(default_factory=list)
    doc_type: list[str] = Field(default_factory=list)
    period: list[str] = Field(default_factory=list)
    branch_id: list[uuid.UUID] = Field(default_factory=list)
    per_group: int = Field(default=5, ge=1, le=50)
    offset: int = Field(default=0, ge=0, le=1000)
    # False for internal lookups (suggestions, AI retrieval) that are not a visitor's own search.
    log: bool = True


class DocumentMeta(BaseModel):
    archive_code: str | None
    date_text: str | None
    doc_type: str | None
    period: str | None
    branch_id: uuid.UUID | None
    # Access *status* only (open/restricted/closed/needs_review); files are never linked here.
    file_access: str
    has_digital_copy: bool


class SearchItem(BaseModel):
    type: ObjectType
    id: uuid.UUID
    title: str
    lang: str  # language of title/snippet (fallback when the requested one is missing)
    snippet: str  # HTML-escaped text; highlights are <mark>…</mark>
    href: str  # site path without the locale prefix, built by the server
    score: float
    matched: list[str]  # fts / trigram / vector
    document: DocumentMeta | None = None


class SearchGroup(BaseModel):
    type: ObjectType
    total: int
    items: list[SearchItem]


class FacetValue(BaseModel):
    value: str
    label: str | None = None
    count: int


class SearchFacets(BaseModel):
    type: list[FacetValue] = Field(default_factory=list)
    doc_type: list[FacetValue] = Field(default_factory=list)
    period: list[FacetValue] = Field(default_factory=list)
    branch: list[FacetValue] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    lang: Lang
    total: int
    groups: list[SearchGroup]
    facets: SearchFacets
    semantic: bool  # False: vector search unavailable (Ollama down), FTS + trigram only
    expanded: list[str] = Field(default_factory=list)  # synonym terms added to the query
