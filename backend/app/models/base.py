import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, MetaData, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.models.enums import WorkflowStatus

# bge-m3 embedding size, measured against the local Ollama (see docs/DECISIONS.md).
# Changing the embedding model requires a new migration for the vector columns.
EMBEDDING_DIM = 1024

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Translatable fields: {"kk": "...", "ru": "...", "en": "..."}
I18n = dict[str, str]


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def str_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


def i18n_column(nullable: bool = False) -> Mapped[I18n]:
    return mapped_column(
        JSONB, nullable=nullable, default=dict, server_default=text("'{}'::jsonb")
    )


class UUIDPkMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ContentMixin(UUIDPkMixin, TimestampMixin):
    """Common fields of all content entities (the project plan §2)."""

    slug: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    workflow_status: Mapped[WorkflowStatus] = mapped_column(
        str_enum(WorkflowStatus, "workflow_status"),
        nullable=False,
        default=WorkflowStatus.DRAFT,
        server_default=WorkflowStatus.DRAFT.value,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    # Per-language translation state: {"kk": "verified", "ru": "verified", "en": "machine"}
    translation_status: Mapped[dict[str, str]] = i18n_column()
