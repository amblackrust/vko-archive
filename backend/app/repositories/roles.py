from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Permission, Role


def list_roles(session: Session) -> list[Role]:
    stmt = select(Role).options(selectinload(Role.permissions)).order_by(Role.code)
    return list(session.scalars(stmt))


def get_role(session: Session, code: str) -> Role | None:
    stmt = select(Role).options(selectinload(Role.permissions)).where(Role.code == code)
    return session.scalars(stmt).one_or_none()


def list_permissions(session: Session) -> list[Permission]:
    return list(session.scalars(select(Permission).order_by(Permission.module, Permission.action)))
