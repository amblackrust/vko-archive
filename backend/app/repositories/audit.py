import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models import AuditLog


@dataclass(frozen=True)
class AuditFilter:
    user_id: uuid.UUID | None = None
    action_type: str | None = None
    object_type: str | None = None
    object_id: str | None = None
    result: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    # Substring of the actor (login) or action type.
    q: str | None = None


def add(session: Session, entry: AuditLog) -> None:
    session.add(entry)


def _filtered(stmt: Select, f: AuditFilter) -> Select:
    if f.user_id:
        stmt = stmt.where(AuditLog.user_id == f.user_id)
    if f.action_type:
        stmt = stmt.where(AuditLog.action_type == f.action_type)
    if f.object_type:
        stmt = stmt.where(AuditLog.object_type == f.object_type)
    if f.object_id:
        stmt = stmt.where(AuditLog.object_id == f.object_id)
    if f.result:
        stmt = stmt.where(AuditLog.result == f.result)
    if f.date_from:
        stmt = stmt.where(AuditLog.ts >= f.date_from)
    if f.date_to:
        stmt = stmt.where(AuditLog.ts <= f.date_to)
    if f.q:
        pattern = "%" + f.q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(or_(AuditLog.actor.ilike(pattern), AuditLog.action_type.ilike(pattern)))
    return stmt


def search(session: Session, f: AuditFilter, *, offset: int, limit: int) -> tuple[list[AuditLog], int]:
    total = session.scalar(_filtered(select(func.count()).select_from(AuditLog), f)) or 0
    stmt = _filtered(select(AuditLog), f).order_by(AuditLog.ts.desc(), AuditLog.id.desc())
    return list(session.scalars(stmt.offset(offset).limit(limit))), total
