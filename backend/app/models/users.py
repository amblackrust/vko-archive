import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, I18n, TimestampMixin, UUIDPkMixin, i18n_column


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # argon2
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    failed_logins: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # In every session token (claim `sev`); logout increments it, revoking all issued tokens.
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Branch scope for branch administrators / archivists. use_alter breaks the
    # users <-> branches FK cycle (branches.created_by -> users).
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL", use_alter=True), index=True
    )

    roles: Mapped[list["Role"]] = relationship(secondary="user_roles", back_populates="users")


# Case-insensitive email uniqueness; services must still store emails normalized (strip + lower).
Index("uq_users_email_lower", func.lower(User.email), unique=True)


class Role(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)  # see RoleCode
    name: Mapped[I18n] = i18n_column()
    description: Mapped[I18n] = i18n_column()
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    users: Mapped[list[User]] = relationship(secondary="user_roles", back_populates="roles")
    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permissions", back_populates="roles"
    )


class Permission(UUIDPkMixin, Base):
    """One cell of the editable action x module matrix."""

    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("module", "action"),)

    module: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[I18n] = i18n_column()

    roles: Mapped[list[Role]] = relationship(secondary="role_permissions", back_populates="permissions")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )
