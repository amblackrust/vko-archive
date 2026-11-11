import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, Field

from app.models.enums import BranchType
from app.schemas.admin_common import I18nText, StrictInput


def _http_url(value: str | None) -> str | None:
    if value and not value.lower().startswith(("http://", "https://")):
        raise ValueError("only http(s) links")
    return value or None


HttpUrl = Annotated[str | None, AfterValidator(_http_url), Field(max_length=1024)]
Slug = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]


class BranchIn(StrictInput):
    slug: Slug
    name: I18nText
    short_name: I18nText = {}
    type: BranchType
    address: I18nText = {}
    phone: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=320)
    director: I18nText = {}
    hours: I18nText = {}
    description: I18nText = {}
    funds_summary: I18nText = {}
    photo_file_id: uuid.UUID | None = None
    lat: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    lng: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    coords_verified: bool = False
    show_on_map: bool = True
    position: int = Field(default=0, ge=0, le=10_000)


class ExhibitionIn(StrictInput):
    slug: Slug
    title: I18nText
    theme: str | None = Field(default=None, max_length=128)
    period: str | None = Field(default=None, max_length=64)
    intro: I18nText = {}
    cover_file_id: uuid.UUID | None = None
    is_demo: bool = False


class ExhibitIn(StrictInput):
    exhibition_id: uuid.UUID
    title: I18nText
    media_file_id: uuid.UUID | None = None
    media_url: HttpUrl = None
    caption: I18nText = {}
    source: I18nText = {}
    archive_code: str | None = Field(default=None, max_length=255)
    document_id: uuid.UUID | None = None
    fund_id: uuid.UUID | None = None
    is_demo: bool = False


class ExhibitOrder(StrictInput):
    ids: list[uuid.UUID] = Field(max_length=500)
