import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DigitalFile


def get_file(session: Session, file_id: uuid.UUID) -> DigitalFile | None:
    return session.get(DigitalFile, file_id)


def files_of_owner(session: Session, owner_type: str, owner_id: uuid.UUID) -> list[DigitalFile]:
    stmt = (
        select(DigitalFile)
        .where(DigitalFile.owner_type == owner_type, DigitalFile.owner_id == owner_id)
        .order_by(DigitalFile.position, DigitalFile.id)
    )
    return list(session.scalars(stmt))


def files_of_owners(session: Session, owner_type: str, owner_ids: Sequence[uuid.UUID]) -> list[DigitalFile]:
    """Files of many owners in one query, each owner's files in their order."""
    if not owner_ids:
        return []
    stmt = (
        select(DigitalFile)
        .where(DigitalFile.owner_type == owner_type, DigitalFile.owner_id.in_(owner_ids))
        .order_by(DigitalFile.owner_id, DigitalFile.position, DigitalFile.id)
    )
    return list(session.scalars(stmt))


def get_owner(session: Session, model: type, owner_id: uuid.UUID) -> Any:
    return session.get(model, owner_id)
