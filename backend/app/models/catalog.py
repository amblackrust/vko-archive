"""Catalog hierarchy: archive (branch) -> fund -> inventory -> case -> document.

FKs use ON DELETE RESTRICT: a parent can only be deleted when it has no children.
"""

import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ContentMixin, I18n, UUIDPkMixin, i18n_column, str_enum
from app.models.enums import DescriptionStatus, FileAccess, FundType

document_tags = Table(
    "document_tags",
    Base.metadata,
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

document_categories = Table(
    "document_categories",
    Base.metadata,
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Fund(ContentMixin, Base):
    __tablename__ = "funds"
    # A fund number is unique within its archive (branch); NULL branch counts as one archive.
    __table_args__ = (
        UniqueConstraint("branch_id", "number", postgresql_nulls_not_distinct=True),
        CheckConstraint("category BETWEEN 1 AND 3", name="category_range"),
        CheckConstraint("ownership IN ('state', 'private')", name="ownership_value"),
        CheckConstraint("restricted = 'partial'", name="restricted_value"),
    )

    number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[I18n] = i18n_column()
    type: Mapped[FundType] = mapped_column(str_enum(FundType, "fund_type"), nullable=False, index=True)
    dates_from: Mapped[int | None] = mapped_column(Integer)  # year
    dates_to: Mapped[int | None] = mapped_column(Integer)  # year
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="RESTRICT"), index=True
    )
    annotation: Mapped[I18n] = i18n_column()
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # Every name the fund's organisation had, oldest first: [{"dates": "1939-1945" | None, "name": "..."}].
    # `title` is the latest one.
    former_names: Mapped[list[dict[str, str | None]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    units_count: Mapped[int | None] = mapped_column(Integer)  # storage units (ед. хр.)
    category: Mapped[int | None] = mapped_column(Integer)  # 1..3
    ownership: Mapped[str | None] = mapped_column(String(16))  # state / private
    first_received: Mapped[date | None] = mapped_column(Date)
    # "partial": some storage units are restricted («ч.с.»), the description is public.
    # Fully secret funds are never stored, so there is no other value.
    restricted: Mapped[str | None] = mapped_column(String(16))
    source: Mapped[str | None] = mapped_column(String(255))  # where the description comes from

    inventories: Mapped[list["Inventory"]] = relationship(back_populates="fund")


class Newspaper(UUIDPkMixin, Base):
    """A newspaper the archive keeps, from its public «Перечень газет» (loaded by the seed).
    The list is public as a whole, so the rows carry no workflow status."""

    __tablename__ = "newspapers"
    # The same title under another publisher is another newspaper.
    __table_args__ = (UniqueConstraint("title", "publisher", postgresql_nulls_not_distinct=True),)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    publisher: Mapped[str | None] = mapped_column(Text)
    year_from: Mapped[int] = mapped_column(Integer, nullable=False)
    year_to: Mapped[int] = mapped_column(Integer, nullable=False)
    volumes_total: Mapped[int] = mapped_column(Integer, nullable=False)
    years_covered: Mapped[list[int]] = mapped_column(JSONB, nullable=False)  # every year that has a volume
    # One entry per bound volume: [{"year": 1958, "volumes": 1, "note": "Том 2" | None}].
    years: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)


class Inventory(ContentMixin, Base):
    __tablename__ = "inventories"
    __table_args__ = (UniqueConstraint("fund_id", "number"),)

    fund_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("funds.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[I18n] = i18n_column()
    dates_text: Mapped[str | None] = mapped_column(String(255))
    dates_from: Mapped[int | None] = mapped_column(Integer)
    dates_to: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    fund: Mapped[Fund] = relationship(back_populates="inventories")
    cases: Mapped[list["Case"]] = relationship(back_populates="inventory")


class Case(ContentMixin, Base):
    __tablename__ = "cases"
    __table_args__ = (UniqueConstraint("inventory_id", "number"),)

    inventory_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    number: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[I18n] = i18n_column()
    dates_text: Mapped[str | None] = mapped_column(String(255))
    dates_from: Mapped[int | None] = mapped_column(Integer)
    dates_to: Mapped[int | None] = mapped_column(Integer)
    sheets_count: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    inventory: Mapped[Inventory] = relationship(back_populates="cases")
    documents: Mapped[list["Document"]] = relationship(back_populates="case")


class Document(ContentMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index(
            "ix_documents_archive_code_trgm",
            "archive_code",
            postgresql_using="gin",
            postgresql_ops={"archive_code": "gin_trgm_ops"},
        ),
        CheckConstraint("date_from <= date_to", name="date_range"),
    )

    # `id` (uuid) is the stable internal id; the archive code (шифр) is a separate field.
    archive_code: Mapped[str | None] = mapped_column(String(255), unique=True)
    # Nullable so a draft/imported document can exist before it is placed in the hierarchy.
    case_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cases.id", ondelete="RESTRICT"), index=True
    )
    title: Mapped[I18n] = i18n_column()
    date_text: Mapped[str | None] = mapped_column(String(255))
    date_from: Mapped[date | None] = mapped_column(Date, index=True)
    date_to: Mapped[date | None] = mapped_column(Date)
    period: Mapped[str | None] = mapped_column(String(64), index=True)
    doc_type: Mapped[str | None] = mapped_column(String(64), index=True)
    language: Mapped[str | None] = mapped_column(String(32))
    authors: Mapped[I18n] = i18n_column()  # authors / organization
    places: Mapped[list[I18n]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    historical_note: Mapped[I18n] = i18n_column()
    summary: Mapped[I18n] = i18n_column()
    sheets_count: Mapped[int | None] = mapped_column(Integer)
    storage_location: Mapped[str | None] = mapped_column(String(255))
    description_status: Mapped[DescriptionStatus] = mapped_column(
        str_enum(DescriptionStatus, "description_status"),
        nullable=False,
        default=DescriptionStatus.NEEDS_REVIEW,
        server_default=DescriptionStatus.NEEDS_REVIEW.value,
        index=True,
    )
    file_access: Mapped[FileAccess] = mapped_column(
        str_enum(FileAccess, "file_access"),
        nullable=False,
        default=FileAccess.NEEDS_REVIEW,
        server_default=FileAccess.NEEDS_REVIEW.value,
    )
    access_conditions: Mapped[I18n] = i18n_column()
    has_digital_copy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="RESTRICT"), index=True
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    case: Mapped[Case | None] = relationship(back_populates="documents")
    tags: Mapped[list["Tag"]] = relationship(secondary=document_tags)  # noqa: F821  (topics)
    categories: Mapped[list["Category"]] = relationship(secondary=document_categories)  # noqa: F821
