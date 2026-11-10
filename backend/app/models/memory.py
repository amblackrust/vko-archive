"""«Архив памяти»: collections, historical persons, chronology events."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Index, Integer, Numeric, String, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ContentMixin, I18n, TimestampMixin, UUIDPkMixin, i18n_column

person_documents = Table(
    "person_documents",
    Base.metadata,
    Column("person_id", ForeignKey("persons.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)

event_documents = Table(
    "event_documents",
    Base.metadata,
    Column("event_id", ForeignKey("historical_events.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)


class Collection(ContentMixin, Base):
    __tablename__ = "collections"

    title: Mapped[I18n] = i18n_column()
    theme: Mapped[str | None] = mapped_column(String(128), index=True)
    period: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[I18n] = i18n_column()
    cover_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")

    items: Mapped[list["CollectionItem"]] = relationship(
        back_populates="collection", order_by="CollectionItem.position", cascade="all, delete-orphan"
    )


class CollectionItem(UUIDPkMixin, TimestampMixin, Base):
    """An entry of a collection; polymorphic reference (document / person / event / exhibit / fund)."""

    __tablename__ = "collection_items"
    __table_args__ = (Index("ix_collection_items_item", "item_type", "item_id"),)

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    note: Mapped[I18n] = i18n_column()

    collection: Mapped[Collection] = relationship(back_populates="items")


class Person(ContentMixin, Base):
    __tablename__ = "persons"

    name: Mapped[I18n] = i18n_column()
    birth_year: Mapped[int | None] = mapped_column(Integer)
    death_year: Mapped[int | None] = mapped_column(Integer)
    years_text: Mapped[str | None] = mapped_column(String(64))
    bio: Mapped[I18n] = i18n_column()
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    # [{"title": "...", "url": "..."}]
    sources: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")

    documents: Mapped[list["Document"]] = relationship(secondary=person_documents)  # noqa: F821


class HistoricalEvent(ContentMixin, Base):
    __tablename__ = "historical_events"
    __table_args__ = (
        CheckConstraint("date_from <= date_to", name="date_range"),
        CheckConstraint("lat BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("lng BETWEEN -180 AND 180", name="lng_range"),
    )

    date_text: Mapped[str | None] = mapped_column(String(64))
    date_from: Mapped[date | None] = mapped_column(Date, index=True)
    date_to: Mapped[date | None] = mapped_column(Date)
    title: Mapped[I18n] = i18n_column()
    description: Mapped[I18n] = i18n_column()
    theme: Mapped[str | None] = mapped_column(String(128), index=True)
    place: Mapped[I18n] = i18n_column()
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    sources: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")

    documents: Mapped[list["Document"]] = relationship(secondary=event_documents)  # noqa: F821
