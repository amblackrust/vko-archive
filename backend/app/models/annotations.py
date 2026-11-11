import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPkMixin


class DocumentAnnotation(UUIDPkMixin, TimestampMixin, Base):
    """AI annotation of a public document, one per language (T4.10). A draft is visible
    to staff only; the visitor sees it in "Briefly about the document" only after a staff
    member approved it (and only while the document itself is public)."""

    __tablename__ = "document_annotations"
    __table_args__ = (
        UniqueConstraint("document_id", "lang"),
        CheckConstraint("status IN ('draft', 'approved')", name="status"),
        CheckConstraint("lang IN ('kk', 'ru', 'en')", name="lang"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    lang: Mapped[str] = mapped_column(String(8), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", server_default="draft")
    # Built partly from OCR text of files: hidden again if those files stop being open.
    uses_file_text: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    model: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
