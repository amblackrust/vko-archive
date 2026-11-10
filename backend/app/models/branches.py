import uuid
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ContentMixin, I18n, i18n_column, str_enum
from app.models.enums import BranchType


class Branch(ContentMixin, Base):
    __tablename__ = "branches"
    __table_args__ = (
        CheckConstraint("lat BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("lng BETWEEN -180 AND 180", name="lng_range"),
    )

    name: Mapped[I18n] = i18n_column()
    short_name: Mapped[I18n] = i18n_column()
    type: Mapped[BranchType] = mapped_column(str_enum(BranchType, "branch_type"), nullable=False)
    address: Mapped[I18n] = i18n_column()
    phone: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(320))
    director: Mapped[I18n] = i18n_column()
    hours: Mapped[I18n] = i18n_column()
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("digital_files.id", ondelete="SET NULL", use_alter=True)
    )
    description: Mapped[I18n] = i18n_column()
    funds_summary: Mapped[I18n] = i18n_column()
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    coords_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    show_on_map: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
