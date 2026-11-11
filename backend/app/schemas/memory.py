"""Public «Архив памяти» contracts (T5.10-T5.12): published content only, links built by the server."""

from pydantic import BaseModel

from app.schemas.catalog import DocumentItem


class MemoryDocument(DocumentItem):
    note: str = ""  # editorial note of the collection entry


class SourceRef(BaseModel):
    title: str
    url: str | None = None


class FacetCount(BaseModel):
    value: str
    count: int


class CollectionItem(BaseModel):
    slug: str
    href: str
    title: str
    title_lang: str
    theme: str | None
    period: str | None
    description: str
    is_demo: bool
    item_count: int
    translation_missing: bool


class CollectionsResponse(BaseModel):
    items: list[CollectionItem]
    themes: list[FacetCount]
    periods: list[FacetCount]


class CollectionDetail(CollectionItem):
    documents: list[MemoryDocument]


class PersonItem(BaseModel):
    slug: str
    href: str
    name: str
    name_lang: str
    years_text: str | None
    birth_year: int | None
    death_year: int | None
    bio: str
    sources: list[SourceRef]
    is_demo: bool
    translation_missing: bool


class PersonDetail(PersonItem):
    documents: list[MemoryDocument]


class PersonsResponse(BaseModel):
    items: list[PersonItem]


class EventItem(BaseModel):
    slug: str
    href: str
    title: str
    title_lang: str
    date_text: str | None
    year: int | None
    theme: str | None
    description: str
    place: str
    lat: float | None
    lng: float | None
    sources: list[SourceRef]
    is_demo: bool
    translation_missing: bool
    documents: list[MemoryDocument]


class TimelineResponse(BaseModel):
    items: list[EventItem]
    themes: list[FacetCount]


class MapPointsResponse(BaseModel):
    items: list[EventItem]
    themes: list[FacetCount]
