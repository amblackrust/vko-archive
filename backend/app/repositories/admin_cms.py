import uuid
from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models import DigitalFile, SiteSetting, Synonym


def _like(q: str) -> str:
    return f"%{q.replace('%', r'\%').replace('_', r'\_')}%"


def search(
    session: Session, model: type, columns: tuple[str, ...], order: tuple[str, ...], *, q: str | None, offset: int, limit: int
) -> tuple[list[Any], int]:
    stmt = select(model)
    if q:
        stmt = stmt.where(or_(*(cast(getattr(model, name), String).ilike(_like(q)) for name in columns)))
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    ordering = [getattr(model, name[1:]).desc() if name.startswith("-") else getattr(model, name) for name in order]
    rows = session.scalars(stmt.order_by(*ordering, model.id).offset(offset).limit(limit))
    return list(rows), total


def count_files(session: Session, owner_type: str, owner_id: uuid.UUID) -> int:
    return session.scalar(select(func.count()).where(DigitalFile.owner_type == owner_type, DigitalFile.owner_id == owner_id)) or 0


def file_owned_by(session: Session, file_id: uuid.UUID, owner_type: str, owner_id: uuid.UUID) -> bool:
    return session.scalar(
        select(func.count()).where(DigitalFile.id == file_id, DigitalFile.owner_type == owner_type, DigitalFile.owner_id == owner_id)
    ) == 1


def list_synonyms(session: Session) -> list[Synonym]:
    return list(session.scalars(select(Synonym).order_by(Synonym.created_at, Synonym.id)))


def get_setting(session: Session, key: str) -> SiteSetting | None:
    return session.get(SiteSetting, key)


def settings_rows(session: Session, keys: list[str]) -> dict[str, SiteSetting]:
    return {row.key: row for row in session.scalars(select(SiteSetting).where(SiteSetting.key.in_(keys)))}
