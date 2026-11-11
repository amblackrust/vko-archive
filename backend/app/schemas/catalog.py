"""Public catalog contracts (T3.3, T3.4, T3.9). Titles are plain text; only public data."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["kk", "ru", "en"]
# Catalog entry groups from the ТЗ §5.3 (defined once, on the server).
Category = Literal["historical", "photos", "maps", "written", "organizations", "personal", "audio_video"]
FundTypeValue = Literal["organization", "personal", "party", "newspaper"]
Sort = Literal["relevance", "date_asc", "date_desc", "code", "title"]
FundSort = Literal["relevance", "number", "title", "year"]
_YEAR = Field(default=None, ge=1000, le=2100)


class CatalogFilters(BaseModel):
    """Query of `GET /api/catalog/documents`. List params are repeated (`doc_type=a&doc_type=b`)."""

    lang: Lang = "ru"
    q: str = Field(default="", max_length=200)  # free text: title, code, author, summary, tags
    title: str = Field(default="", max_length=200)
    fund_number: str = Field(default="", max_length=64)
    inventory_number: str = Field(default="", max_length=64)
    case_number: str = Field(default="", max_length=64)
    period: list[str] = Field(default_factory=list, max_length=20)
    year: int | None = Field(default=None, ge=1000, le=2100)
    date_from: date | None = None
    date_to: date | None = None
    author: str = Field(default="", max_length=200)
    topic: list[uuid.UUID] = Field(default_factory=list, max_length=20)  # tag ids
    place: str = Field(default="", max_length=200)
    keyword: str = Field(default="", max_length=200)
    doc_type: list[str] = Field(default_factory=list, max_length=20)
    branch_id: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    category: Category | None = None
    fund_type: list[FundTypeValue] = Field(default_factory=list, max_length=4)
    language: list[str] = Field(default_factory=list, max_length=10)
    has_digital_copy: bool | None = None
    sort: Sort = "relevance"
    page: int = Field(default=1, ge=1, le=10_000)
    per_page: int = Field(default=20, ge=1, le=100)


class PageParams(BaseModel):
    lang: Lang = "ru"
    q: str = Field(default="", max_length=200)
    page: int = Field(default=1, ge=1, le=10_000)
    per_page: int = Field(default=20, ge=1, le=100)


class FundListParams(PageParams):
    """`q` looks in the number, the title and every former name; words of 4+ letters tolerate a typo."""

    type: FundTypeValue | None = None
    branch_id: uuid.UUID | None = None
    category: int | None = Field(default=None, ge=1, le=3)
    year: int | None = _YEAR  # the fund has documents of this year ...
    year_from: int | None = _YEAR  # ... or of some year in this range
    year_to: int | None = _YEAR
    sort: FundSort = "relevance"  # without `q` relevance means "number"


class NewspaperParams(PageParams):
    year: int | None = _YEAR  # the archive keeps a volume of this year


class Ref(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    href: str


class DocumentItem(BaseModel):
    id: uuid.UUID
    title: str
    title_lang: str  # language of `title` (fallback when the requested one is missing)
    href: str
    archive_code: str | None
    date_text: str | None
    doc_type: str | None
    period: str | None
    language: str | None
    authors: str
    places: list[str]
    sheets_count: int | None
    file_access: str  # status only; the files themselves are listed on the document card
    has_digital_copy: bool
    # Thumbnail of the first copy (/api/files/{id}?variant=preview), only while anonymous visitors may open that file.
    preview_url: str | None = None
    branch_id: uuid.UUID | None
    is_demo: bool
    fund: Ref | None  # the chain is shown only while fund, inventory and case are all published
    inventory: Ref | None
    case: Ref | None


class FacetValue(BaseModel):
    value: str
    label: str | None = None
    count: int


class CatalogFacets(BaseModel):
    doc_type: list[FacetValue]
    period: list[FacetValue]
    language: list[FacetValue]
    branch: list[FacetValue]
    topic: list[FacetValue]
    fund_type: list[FacetValue]
    category: list[FacetValue]
    with_digital_copy: int


class Pagination(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int


class DocumentsResponse(Pagination):
    items: list[DocumentItem]
    facets: CatalogFacets
    sort: Sort  # effective sort


class FormerName(BaseModel):
    dates: str | None  # as written in the fund list: «1939-1945», «28.08.2001-»
    name: str


class FundItem(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    title_lang: str
    type: str
    dates_from: int | None
    dates_to: int | None
    branch_id: uuid.UUID | None
    annotation: str
    is_demo: bool
    inventory_count: int
    document_count: int
    href: str
    former_names: list[FormerName]  # oldest first; the last one is the title
    units_count: int | None
    category: int | None
    ownership: str | None  # state / private
    first_received: date | None
    restricted: str | None  # "partial": some storage units are not open; never a count of them
    source: str | None


class InventoryItem(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    title_lang: str
    dates_text: str | None
    is_demo: bool
    case_count: int
    document_count: int
    href: str
    fund: Ref


class CaseItem(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    title_lang: str
    dates_text: str | None
    sheets_count: int | None
    is_demo: bool
    document_count: int
    href: str
    inventory: Ref
    fund: Ref


class FundsResponse(Pagination):
    items: list[FundItem]
    sort: FundSort  # effective sort


class NewspaperYear(BaseModel):
    year: int
    volumes: int
    note: str | None


class NewspaperItem(BaseModel):
    id: uuid.UUID
    title: str
    publisher: str | None
    year_from: int
    year_to: int
    volumes_total: int
    years: list[NewspaperYear]  # one entry per bound volume


class NewspapersResponse(Pagination):
    items: list[NewspaperItem]


class InventoriesResponse(Pagination):
    items: list[InventoryItem]


class CasesResponse(Pagination):
    items: list[CaseItem]


class BranchRef(BaseModel):
    name: str
    href: str


class FundDetail(FundItem):
    inventories: list[InventoryItem]
    branch: BranchRef | None  # the published branch that holds the fund


class InventoryDetail(InventoryItem):
    cases: CasesResponse


class CaseDetail(CaseItem):
    documents: "DocumentPage"


class DocumentPage(Pagination):
    items: list[DocumentItem]


class DocumentFile(BaseModel):
    """A file the viewer may open. Only ids and /api/files URLs, never storage paths."""

    id: uuid.UUID
    position: int
    mime: str
    pages: int | None
    url: str
    preview_url: str | None
    caption: str
    provenance: str  # where the copy comes from (source page, changes made to it)
    rights_note: str  # author and licence
    ocr_text: str | None


class TagRef(BaseModel):
    id: uuid.UUID
    name: str
    href: str  # catalog filtered by this topic


class DocumentAnnotationPublic(BaseModel):
    """"Briefly about the document" (T4.10): AI text approved by a staff member."""

    text: str
    lang: str
    label: str  # the AI mark, always shown with the text


class DocumentDetail(DocumentItem):
    """Document card (T3.5). Only public documents exist here; restricted/closed ones come
    with the access conditions and an empty `files` list."""

    historical_note: str
    summary: str
    storage_location: str | None
    access_conditions: str
    branch: str | None  # name of the (published) branch that keeps the document
    tags: list[TagRef]
    files: list[DocumentFile]
    related: list[DocumentItem]
    annotation: DocumentAnnotationPublic | None = None
