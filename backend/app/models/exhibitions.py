import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ContentMixin, I18n, i18n_column


class Exhibition(ContentMixin, Base):
    __tablename__ = "exhibitions"

    title: Mapped[I18n] = i18n_column()
    theme: Mapped[str | None] = mapped_column(String(128), index=True)
    period: Mapped[str | None] = mapped_column(String(64))
    intro: Mapped[I18n] = i18n_column()
    cover_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")

    exhibits: Mapped[list["Exhibit"]] = relationship(
        back_populates="exhibition", order_by="Exhibit.position"
    )


class Exhibit(ContentMixin, Base):
    __tablename__ = "exhibits"

    exhibition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exhibitions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    title: Mapped[I18n] = i18n_column()
    media_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("digital_files.id", ondelete="SET NULL"))
    media_url: Mapped[str | None] = mapped_column(String(1024))  # external video etc.
    caption: Mapped[I18n] = i18n_column()
    source: Mapped[I18n] = i18n_column()
    archive_code: Mapped[str | None] = mapped_column(String(255))
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), index=True
    )
    fund_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("funds.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(default=False, server_default="false")

    exhibition: Mapped[Exhibition] = relationship(back_populates="exhibits")
