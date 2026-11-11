import uuid

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models import Branch, DigitalFile, Document, Exhibit, Exhibition, Fund, User


def _like(q: str) -> str:
    return f"%{q.replace('%', r'\%').replace('_', r'\_')}%"


def search_branches(session: Session, *, q: str | None, branch_id: uuid.UUID | None, offset: int, limit: int) -> tuple[list[Branch], int]:
    stmt = select(Branch)
    if branch_id is not None:
        stmt = stmt.where(Branch.id == branch_id)
    if q:
        stmt = stmt.where(or_(Branch.slug.ilike(_like(q)), cast(Branch.name, String).ilike(_like(q))))
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.order_by(Branch.position, Branch.slug).offset(offset).limit(limit))
    return list(rows), total


def branch_dependents(session: Session, branch_id: uuid.UUID) -> int:
    return sum(
        session.scalar(select(func.count()).where(column == branch_id)) or 0
        for column in (Fund.branch_id, Document.branch_id, User.branch_id)
    )


def search_exhibitions(session: Session, *, q: str | None, offset: int, limit: int) -> tuple[list[Exhibition], int]:
    stmt = select(Exhibition)
    if q:
        stmt = stmt.where(or_(Exhibition.slug.ilike(_like(q)), cast(Exhibition.title, String).ilike(_like(q))))
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.order_by(Exhibition.updated_at.desc(), Exhibition.id).offset(offset).limit(limit))
    return list(rows), total


def exhibits_of(session: Session, exhibition_id: uuid.UUID) -> list[Exhibit]:
    stmt = select(Exhibit).where(Exhibit.exhibition_id == exhibition_id).order_by(Exhibit.position, Exhibit.id)
    return list(session.scalars(stmt))


def count_exhibits(session: Session, exhibition_id: uuid.UUID) -> int:
    return session.scalar(select(func.count()).where(Exhibit.exhibition_id == exhibition_id)) or 0


def next_exhibit_position(session: Session, exhibition_id: uuid.UUID) -> int:
    top = session.scalar(select(func.max(Exhibit.position)).where(Exhibit.exhibition_id == exhibition_id))
    return 0 if top is None else top + 1


def file_owned_by(session: Session, file_id: uuid.UUID, owner_type: str, owner_id: uuid.UUID) -> bool:
    return session.scalar(
        select(func.count()).where(
            DigitalFile.id == file_id, DigitalFile.owner_type == owner_type, DigitalFile.owner_id == owner_id
        )
    ) == 1
