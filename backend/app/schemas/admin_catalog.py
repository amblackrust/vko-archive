import uuid
from datetime import date

from pydantic import Field

from app.models.enums import DescriptionStatus, FileAccess, FundType
from app.schemas.admin_common import I18nText, StrictInput

_YEAR = Field(default=None, ge=1000, le=2100)


class FundIn(StrictInput):
    number: str = Field(min_length=1, max_length=64)
    title: I18nText
    type: FundType
    dates_from: int | None = _YEAR
    dates_to: int | None = _YEAR
    branch_id: uuid.UUID | None = None
    annotation: I18nText = {}
    is_demo: bool = False


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
