import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, I18n, i18n_column, str_enum
from app.models.enums import AuditResult


class AuditLog(Base):
    """Action journal. `details` must never contain passwords, tokens or other secrets."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_object", "object_type", "object_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Login label snapshot: kept for failed logins and after a user is deleted.
    actor: Mapped[str | None] = mapped_column(String(320))
    action_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    object_type: Mapped[str | None] = mapped_column(String(64))
    object_id: Mapped[str | None] = mapped_column(String(64))
    result: Mapped[AuditResult] = mapped_column(str_enum(AuditResult, "audit_result"), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    ip: Mapped[str | None] = mapped_column(String(64))


class WorkflowHistory(Base):
    __tablename__ = "workflow_history"
    __table_args__ = (Index("ix_workflow_history_object", "object_type", "object_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    object_type: Mapped[str] = mapped_column(String(64), nullable=False)
    object_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    comment: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    # Object state at this version, used for diffs in the version history.
    snapshot: Mapped[dict | None] = mapped_column(JSONB)


class Notification(Base):
    """In-admin notifications (bell) for workflow events."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[I18n] = i18n_column()
    object_type: Mapped[str | None] = mapped_column(String(64))
    object_id: Mapped[uuid.UUID | None] = mapped_column()
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
