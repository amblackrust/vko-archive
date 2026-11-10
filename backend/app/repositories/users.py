import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Permission, Role, RolePermission, User, UserRole
from app.models.enums import RoleCode


def get_by_email(session: Session, email: str, *, for_update: bool = False) -> User | None:
    stmt = select(User).where(func.lower(User.email) == email)
    if for_update:
        stmt = stmt.with_for_update()
    return session.scalars(stmt).one_or_none()


def get_by_id(session: Session, user_id: uuid.UUID, *, for_update: bool = False) -> User | None:
    return session.get(User, user_id, with_for_update=for_update)


def role_codes(session: Session, user_id: uuid.UUID) -> set[str]:
    stmt = select(Role.code).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user_id)
    return set(session.scalars(stmt))


def permission_keys(session: Session, user_id: uuid.UUID) -> set[str]:
    stmt = (
        select(Permission.module, Permission.action)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    )
    return {f"{module}.{action}" for module, action in session.execute(stmt)}


def active_users_with_permission(session: Session, module: str, action: str) -> list[User]:
    """Active users whose roles grant module.action, plus all super admins."""
    granted_roles = (
        select(RolePermission.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(Permission.module == module, Permission.action == action)
    )
    stmt = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.is_active.is_(True))
        .where(or_(Role.id.in_(granted_roles), Role.code == RoleCode.SUPER_ADMIN.value))
        .distinct()
    )
    return list(session.scalars(stmt))
