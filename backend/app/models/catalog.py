"""Catalog hierarchy: archive (branch) -> fund -> inventory -> case -> document.

FKs use ON DELETE RESTRICT: a parent can only be deleted when it has no children.
"""

import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ContentMixin, I18n, i18n_column, str_enum
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

    inventories: Mapped[list["Inventory"]] = relationship(back_populates="fund")


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
