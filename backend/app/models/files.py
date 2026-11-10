import uuid

from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, I18n, TimestampMixin, UUIDPkMixin, i18n_column, str_enum
from app.models.enums import FileAccess, OcrStatus


class DigitalFile(UUIDPkMixin, TimestampMixin, Base):
    """A stored file (master + preview). Paths are relative to the storage dir and
    must never be exposed in public API responses; files are served only through
    GET /api/files/{id} after an access check: the file's own `access` must allow it
    AND, if the owner is a document, the document's `file_access` must allow it too
    (see docs/DECISIONS.md, B01 review)."""

    __tablename__ = "digital_files"
    __table_args__ = (Index("ix_digital_files_owner", "owner_type", "owner_id"),)

    # Polymorphic owner: document / exhibit / exhibition / news / person / branch / page / legal_act / ...
    owner_type: Mapped[str | None] = mapped_column(String(32))
    owner_id: Mapped[uuid.UUID | None] = mapped_column()
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    original_name: Mapped[str | None] = mapped_column(String(255))
    master_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    preview_path: Mapped[str | None] = mapped_column(String(1024))
    mime: Mapped[str] = mapped_column(String(128), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    pages: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    provenance: Mapped[I18n] = i18n_column()
    rights_note: Mapped[I18n] = i18n_column()
    caption: Mapped[I18n] = i18n_column()
    ocr_text: Mapped[str | None] = mapped_column(Text)
    ocr_status: Mapped[OcrStatus] = mapped_column(
        str_enum(OcrStatus, "ocr_status"),
        nullable=False,
        default=OcrStatus.NONE,
        server_default=OcrStatus.NONE.value,
    )
    # The file's own access level, independent of the owner: a file attached to a
    # non-document owner (exhibit, news, ...) cannot inherit a document's restrictions.
    access: Mapped[FileAccess] = mapped_column(
        str_enum(FileAccess, "file_access"),
        nullable=False,
        default=FileAccess.NEEDS_REVIEW,
        server_default=FileAccess.NEEDS_REVIEW.value,
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
