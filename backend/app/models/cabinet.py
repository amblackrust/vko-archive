"""Visitor cabinet (T5.18). Visitors are NOT staff: they live in their own table and never get
roles or permissions, so `authorize()` treats every visitor request as anonymous. The cabinet
stores only the visitor's own preferences: favorites, personal selections, search history and
news/exhibition subscriptions. No requests, orders or payments exist here."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPkMixin

FAVORITE_TYPES = ("document", "exhibition", "news")
SUBSCRIPTION_TOPICS = ("news", "exhibitions")


class Visitor(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "visitors"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # argon2
    display_name: Mapped[str] = mapped_column(String(100), nullable=False, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    failed_logins: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # In every session token (claim `sev`); logout increments it, revoking all issued tokens.
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    email_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


Index("uq_visitors_email_lower", func.lower(Visitor.email), unique=True)

TOKEN_PURPOSES = ("password_reset", "email_confirm")


class VisitorToken(UUIDPkMixin, Base):
    """One-time e-mail token (password reset / e-mail confirmation). Only the SHA-256 of the
    token is stored: the database never holds a usable link."""

    __tablename__ = "visitor_tokens"
    __table_args__ = (CheckConstraint("purpose IN ('password_reset', 'email_confirm')", name="purpose"),)

    visitor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VisitorFavorite(Base):
    __tablename__ = "visitor_favorites"
    __table_args__ = (
        CheckConstraint("object_type IN ('document', 'exhibition', 'news')", name="object_type"),
    )

    visitor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("visitors.id", ondelete="CASCADE"), primary_key=True)
    object_type: Mapped[str] = mapped_column(String(16), primary_key=True)
    object_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)  # polymorphic, checked on write and read
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VisitorSelection(UUIDPkMixin, Base):
    """A personal selection (подборка) of public documents."""

    __tablename__ = "visitor_selections"

    visitor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VisitorSelectionItem(Base):
    __tablename__ = "visitor_selection_items"

    selection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitor_selections.id", ondelete="CASCADE"), primary_key=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VisitorSearch(UUIDPkMixin, Base):
    __tablename__ = "visitor_searches"

    visitor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VisitorSubscription(Base):
    """Interest in new items of a section. Demo: nothing is sent (no mail integration)."""

    __tablename__ = "visitor_subscriptions"
    __table_args__ = (CheckConstraint("topic IN ('news', 'exhibitions')", name="topic"),)

    visitor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("visitors.id", ondelete="CASCADE"), primary_key=True)
    topic: Mapped[str] = mapped_column(String(16), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
