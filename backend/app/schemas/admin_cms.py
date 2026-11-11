"""Input schemas of the admin CMS: news, pages, FAQ, legal acts, price list, calendar, «Архив памяти»,
search synonyms and site settings (B16). Unknown fields are rejected; HTML is cleaned in the service."""

import uuid
import datetime as dt
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.models.enums import LegalActStatus
from app.schemas.admin_common import LANGS, I18nText, StrictInput
from app.schemas.admin_content import HttpUrl, Slug

RICH_MAX_CHARS = 200_000


def clean_rich(value: dict[str, str]) -> dict[str, str]:
    """kk/ru/en keys only; long HTML allowed. The markup itself is sanitized by services.sanitize."""
    if set(value) - set(LANGS):
        raise ValueError("unknown language")
    cleaned = {lang: text.strip() for lang, text in value.items()}
    if any(len(text) > RICH_MAX_CHARS for text in cleaned.values()):
        raise ValueError("text too long")
    return {lang: text for lang, text in cleaned.items() if text}


RichText = Annotated[dict[str, str], AfterValidator(clean_rich)]
Short = Annotated[str | None, Field(max_length=64)]


class SourceLink(StrictInput):
    title: Annotated[str, Field(min_length=1, max_length=255)]
    url: HttpUrl = None


class NewsIn(StrictInput):
    slug: Slug
    title: I18nText
    summary: I18nText = {}
    body: RichText = {}
    category: Short = None
    cover_file_id: uuid.UUID | None = None
    published_at: dt.datetime | None = None
    is_demo: bool = False


class PageIn(StrictInput):
    key: Slug
    section: Short = None
    title: I18nText
    body: RichText = {}
    seo_title: I18nText = {}
    seo_description: I18nText = {}
    seo_keywords: I18nText = {}
    position: int = Field(default=0, ge=0, le=10_000)


class FaqIn(StrictInput):
    category: Annotated[str, Field(min_length=1, max_length=64)]
    question: I18nText
    answer: I18nText
    position: int = Field(default=0, ge=0, le=10_000)


class LegalActIn(StrictInput):
    slug: Slug
    title: I18nText
    number: Short = None
    date: dt.date | None = None
    issuer: I18nText = {}
    status: LegalActStatus = LegalActStatus.ACTIVE
    adilet_url: HttpUrl = None
    file_id: uuid.UUID | None = None
    actualized_at: dt.date | None = None


class PriceItemIn(StrictInput):
    name: I18nText
    unit: I18nText = {}
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    note: I18nText = {}
    act_ref: str | None = Field(default=None, max_length=255)
    legal_act_id: uuid.UUID | None = None
    actualized_at: dt.date | None = None
    position: int = Field(default=0, ge=0, le=10_000)


class MemorialDateIn(StrictInput):
    year: int = Field(ge=1000, le=2200)
    month: int = Field(ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)
    event_year: int | None = Field(default=None, ge=0, le=2200)
    date_text: Short = None
    text: I18nText


class CollectionIn(StrictInput):
    slug: Slug
    title: I18nText
    theme: str | None = Field(default=None, max_length=128)
    period: Short = None
    description: I18nText = {}
    cover_file_id: uuid.UUID | None = None
    is_demo: bool = False


class PersonIn(StrictInput):
    slug: Slug
    name: I18nText
    birth_year: int | None = Field(default=None, ge=0, le=2200)
    death_year: int | None = Field(default=None, ge=0, le=2200)
    years_text: Short = None
    bio: I18nText = {}
    photo_file_id: uuid.UUID | None = None
    sources: list[SourceLink] = Field(default=[], max_length=50)
    is_demo: bool = False


class EventIn(StrictInput):
    slug: Slug
    date_text: Short = None
    date_from: dt.date | None = None
    date_to: dt.date | None = None
    title: I18nText
    description: I18nText = {}
    theme: str | None = Field(default=None, max_length=128)
    place: I18nText = {}
    lat: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    lng: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    sources: list[SourceLink] = Field(default=[], max_length=50)
    is_demo: bool = False


class CollectionItemIn(StrictInput):
    item_type: Literal["document", "person", "historical_event"]
    item_id: uuid.UUID
    note: I18nText = {}


class CollectionItemsIn(StrictInput):
    version: int
    items: list[CollectionItemIn] = Field(max_length=500)


class DocumentLinksIn(StrictInput):
    version: int
    document_ids: list[uuid.UUID] = Field(max_length=200)


class SynonymIn(StrictInput):
    terms: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(min_length=2, max_length=30)
    note: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class SynonymPatch(StrictInput):
    terms: list[Annotated[str, Field(min_length=1, max_length=100)]] | None = Field(default=None, min_length=2, max_length=30)
    note: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


# Site settings: each key has its own validated shape (settings.edit only).
class SettingModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SocialLink(SettingModel):
    url: HttpUrl = None
    handle: str | None = Field(default=None, max_length=64)


class SocialSettings(SettingModel):
    # Same shape as the seeded value: {"instagram": {"handle": "@x", "url": "https://..."}}.
    instagram: SocialLink = SocialLink()
    facebook: SocialLink = SocialLink()
    telegram: SocialLink = SocialLink()
    youtube: SocialLink = SocialLink()
    whatsapp: SocialLink = SocialLink()


class WidgetSettings(SettingModel):
    calendar_weather: bool = True
    rating: bool = False
    statistics: bool = False


class SurveySettings(SettingModel):
    enabled: bool = False
    question: I18nText = {}
    url: HttpUrl = None


class CounterSettings(SettingModel):
    enabled: bool = False
    base_value: int = Field(default=0, ge=0, le=1_000_000_000)


class UsefulLink(SettingModel):
    title: I18nText
    url: Annotated[str, Field(min_length=8, max_length=1024, pattern=r"^https?://")]


class UsefulLinksSettings(SettingModel):
    items: list[UsefulLink] = Field(default=[], max_length=100)


SETTING_MODELS: dict[str, type[SettingModel]] = {
    "social": SocialSettings,
    "widgets": WidgetSettings,
    "survey": SurveySettings,
    "counter": CounterSettings,
    "useful_links": UsefulLinksSettings,
}


class SettingBody(StrictInput):
    value: dict
