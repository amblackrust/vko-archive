"""CMS content: news, pages, FAQ, legal acts, price list, memorial dates, taxonomy, settings."""

import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ContentMixin, I18n, i18n_column, str_enum
from app.models.enums import LegalActStatus

# Polymorphic links to other content: [{"type": "document", "id": "<uuid>"}, ...]
RelatedList = list[dict[str, str]]


def related_column() -> Mapped[RelatedList]:
    return mapped_column(JSONB, nullable=False, default=list, server_default="[]")


class News(ContentMixin, Base):
    __tablename__ = "news"

    title: Mapped[I18n] = i18n_column()
    summary: Mapped[I18n] = i18n_column()
    body: Mapped[I18n] = i18n_column()  # rich text (sanitized HTML) per language
    category: Mapped[str | None] = mapped_column(String(64), index=True)
    cover_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    # [{"file_id": "<uuid>"} | {"url": "https://..."}]
    media: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    related: Mapped[RelatedList] = related_column()
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")


class Page(ContentMixin, Base):
    __tablename__ = "pages"

    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    section: Mapped[str | None] = mapped_column(String(64), index=True)
    title: Mapped[I18n] = i18n_column()
    body: Mapped[I18n] = i18n_column()  # rich text (sanitized HTML) per language
    seo_title: Mapped[I18n] = i18n_column()
    seo_description: Mapped[I18n] = i18n_column()
    seo_keywords: Mapped[I18n] = i18n_column()
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class FAQ(ContentMixin, Base):
    __tablename__ = "faqs"

    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    question: Mapped[I18n] = i18n_column()
    answer: Mapped[I18n] = i18n_column()
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class LegalAct(ContentMixin, Base):
    __tablename__ = "legal_acts"

    title: Mapped[I18n] = i18n_column()
    number: Mapped[str | None] = mapped_column(String(64))
    date: Mapped[date_type | None] = mapped_column()
    issuer: Mapped[I18n] = i18n_column()
    status: Mapped[LegalActStatus] = mapped_column(
        str_enum(LegalActStatus, "legal_act_status"),
        nullable=False,
        default=LegalActStatus.ACTIVE,
        server_default=LegalActStatus.ACTIVE.value,
    )
    adilet_url: Mapped[str | None] = mapped_column(String(1024))
    file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    actualized_at: Mapped[date_type | None] = mapped_column()


class PriceListItem(ContentMixin, Base):
    __tablename__ = "price_list_items"

    name: Mapped[I18n] = i18n_column()
    unit: Mapped[I18n] = i18n_column()
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    note: Mapped[I18n] = i18n_column()
    act_ref: Mapped[str | None] = mapped_column(String(255))
    legal_act_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("legal_acts.id", ondelete="SET NULL"))
    actualized_at: Mapped[date_type | None] = mapped_column()
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class MemorialDate(ContentMixin, Base):
    __tablename__ = "memorial_dates"
    __table_args__ = (
        CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),
        CheckConstraint("day BETWEEN 1 AND 31", name="day_range"),
    )

    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # calendar year (2022..2026)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[int | None] = mapped_column(Integer)
    event_year: Mapped[int | None] = mapped_column(Integer)  # year of the commemorated event
    date_text: Mapped[str | None] = mapped_column(String(64))
    text: Mapped[I18n] = i18n_column()
    related: Mapped[RelatedList] = related_column()


class Tag(ContentMixin, Base):
    __tablename__ = "tags"

    name: Mapped[I18n] = i18n_column()


class Category(ContentMixin, Base):
    __tablename__ = "categories"

    # What the category applies to: catalog / news / faq / exhibition / ...
    scope: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    name: Mapped[I18n] = i18n_column()
    description: Mapped[I18n] = i18n_column()
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class SiteSetting(Base):
    """Key-value site settings (social links, counters, widgets, survey toggle...)."""

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[dict | list | str | int | bool | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
