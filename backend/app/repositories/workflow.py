import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Notification, WorkflowHistory


def update_if_version(
    session: Session, model: type, object_id: uuid.UUID, expected_version: int, values: dict[str, Any]
) -> int | None:
    """Optimistic lock: UPDATE ... SET values, version = version + 1 WHERE id AND version.
    Returns the new version, or None if the row is missing or its version changed."""
    stmt = (
        update(model)
        .where(model.id == object_id, model.version == expected_version)
        .values(**values, version=model.version + 1)
        .returning(model.version)
        .execution_options(synchronize_session=False)
    )
    return session.execute(stmt).scalar_one_or_none()


def add_history(session: Session, entry: WorkflowHistory) -> None:
    session.add(entry)


def history(session: Session, object_type: str, object_id: uuid.UUID) -> list[WorkflowHistory]:
    stmt = (
        select(WorkflowHistory)
        .where(WorkflowHistory.object_type == object_type, WorkflowHistory.object_id == object_id)
        .order_by(WorkflowHistory.ts, WorkflowHistory.id)
    )
    return list(session.scalars(stmt))


def last_submitter(session: Session, object_type: str, object_id: uuid.UUID, review_status: str) -> uuid.UUID | None:
    stmt = (
        select(WorkflowHistory.user_id)
        .where(
            WorkflowHistory.object_type == object_type,
            WorkflowHistory.object_id == object_id,
            WorkflowHistory.to_status == review_status,
        )
        .order_by(WorkflowHistory.ts.desc(), WorkflowHistory.id.desc())
        .limit(1)
    )
    return session.scalar(stmt)


def add_notification(session: Session, notification: Notification) -> None:
    session.add(notification)


def notifications_for(session: Session, user_id: uuid.UUID, *, unread_only: bool, limit: int) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    return list(session.scalars(stmt))


def unread_count(session: Session, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.is_read.is_(False)
    )
    return session.scalar(stmt) or 0


def mark_read(session: Session, user_id: uuid.UUID, notification_id: int | None) -> int:
    """Marks one (or, with None, every) notification of the user as read; returns the row count."""
    stmt = update(Notification).where(Notification.user_id == user_id)
    if notification_id is not None:
        stmt = stmt.where(Notification.id == notification_id)
    else:
        stmt = stmt.where(Notification.is_read.is_(False))
    return session.execute(stmt.values(is_read=True)).rowcount
