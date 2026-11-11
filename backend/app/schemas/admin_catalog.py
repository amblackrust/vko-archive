import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import Field
from typing_extensions import TypedDict

from app.models.enums import DescriptionStatus, FileAccess, FundType
from app.schemas.admin_common import I18nText, StrictInput

_YEAR = Field(default=None, ge=1000, le=2100)


class FormerName(TypedDict):
    dates: Annotated[str | None, Field(max_length=255)]
    name: Annotated[str, Field(min_length=1, max_length=1000)]


class FundIn(StrictInput):
    number: str = Field(min_length=1, max_length=64)
    title: I18nText
    type: FundType
    dates_from: int | None = _YEAR
    dates_to: int | None = _YEAR
    branch_id: uuid.UUID | None = None
    annotation: I18nText = {}
    is_demo: bool = False
    former_names: list[FormerName] = Field(default_factory=list, max_length=100)
    units_count: int | None = Field(default=None, ge=0, le=10_000_000)
    category: int | None = Field(default=None, ge=1, le=3)
    ownership: Literal["state", "private"] | None = None
    first_received: date | None = None
    # A fully secret fund is not marked here: it must stay unpublished.
    restricted: Literal["partial"] | None = None
    source: str | None = Field(default=None, max_length=255)


class InventoryIn(StrictInput):
    fund_id: uuid.UUID
    number: str = Field(min_length=1, max_length=64)
    title: I18nText = {}
    dates_text: str | None = Field(default=None, max_length=255)
    dates_from: int | None = _YEAR
    dates_to: int | None = _YEAR
    is_demo: bool = False


class CaseIn(StrictInput):
    inventory_id: uuid.UUID
    number: str = Field(min_length=1, max_length=64)
    title: I18nText = {}
    dates_text: str | None = Field(default=None, max_length=255)
    dates_from: int | None = _YEAR
    dates_to: int | None = _YEAR
    sheets_count: int | None = Field(default=None, ge=0, le=100_000)
    is_demo: bool = False


class DocumentIn(StrictInput):
    archive_code: str = Field(min_length=1, max_length=255)
    case_id: uuid.UUID | None = None
    title: I18nText
    date_text: str | None = Field(default=None, max_length=255)
    date_from: date | None = None
    date_to: date | None = None
    period: str | None = Field(default=None, max_length=64)
    doc_type: str | None = Field(default=None, max_length=64)
    language: str | None = Field(default=None, max_length=32)
    authors: I18nText = {}
    places: list[I18nText] = Field(default_factory=list, max_length=50)
    historical_note: I18nText = {}
    summary: I18nText = {}
    sheets_count: int | None = Field(default=None, ge=0, le=1_000_000)
    storage_location: str | None = Field(default=None, max_length=255)
    description_status: DescriptionStatus = DescriptionStatus.NEEDS_REVIEW
    file_access: FileAccess = FileAccess.NEEDS_REVIEW
    access_conditions: I18nText = {}
    branch_id: uuid.UUID | None = None  # only for documents outside the hierarchy
    is_demo: bool = False
