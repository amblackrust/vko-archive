"""Storage of the visitor cabinet. Every query is scoped by `visitor_id`: callers pass the
authenticated visitor's id and never an id taken from the request."""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    Visitor,
    VisitorFavorite,
    VisitorSearch,
    VisitorSelection,
    VisitorSelectionItem,
    VisitorSubscription,
)


def visitor_by_email(session: Session, email: str, *, for_update: bool = False) -> Visitor | None:
    stmt = select(Visitor).where(func.lower(Visitor.email) == email.lower())
    return session.scalar(stmt.with_for_update() if for_update else stmt)


def visitor_by_id(session: Session, visitor_id: uuid.UUID, *, for_update: bool = False) -> Visitor | None:
    return session.get(Visitor, visitor_id, with_for_update=for_update)


# favorites
def favorites(session: Session, visitor_id: uuid.UUID) -> list[VisitorFavorite]:
    stmt = select(VisitorFavorite).where(VisitorFavorite.visitor_id == visitor_id).order_by(VisitorFavorite.created_at.desc())
    return list(session.scalars(stmt))


def count_favorites(session: Session, visitor_id: uuid.UUID) -> int:
    return session.scalar(select(func.count()).select_from(VisitorFavorite).where(VisitorFavorite.visitor_id == visitor_id)) or 0


def has_favorite(session: Session, visitor_id: uuid.UUID, object_type: str, object_id: uuid.UUID) -> bool:
    return session.get(VisitorFavorite, (visitor_id, object_type, object_id)) is not None


def add_favorite(session: Session, visitor_id: uuid.UUID, object_type: str, object_id: uuid.UUID) -> None:
    session.execute(
        insert(VisitorFavorite).values(visitor_id=visitor_id, object_type=object_type, object_id=object_id).on_conflict_do_nothing()
    )


def remove_favorite(session: Session, visitor_id: uuid.UUID, object_type: str, object_id: uuid.UUID) -> None:
    session.execute(
        delete(VisitorFavorite).where(
            VisitorFavorite.visitor_id == visitor_id,
            VisitorFavorite.object_type == object_type,
            VisitorFavorite.object_id == object_id,
        )
    )


# selections
def selections(session: Session, visitor_id: uuid.UUID) -> list[VisitorSelection]:
    stmt = select(VisitorSelection).where(VisitorSelection.visitor_id == visitor_id).order_by(VisitorSelection.created_at)
    return list(session.scalars(stmt))


def own_selection(session: Session, visitor_id: uuid.UUID, selection_id: uuid.UUID) -> VisitorSelection | None:
    return session.scalar(
        select(VisitorSelection).where(VisitorSelection.id == selection_id, VisitorSelection.visitor_id == visitor_id)
    )


def count_selections(session: Session, visitor_id: uuid.UUID) -> int:
    return session.scalar(select(func.count()).select_from(VisitorSelection).where(VisitorSelection.visitor_id == visitor_id)) or 0


def selection_document_ids(session: Session, selection_id: uuid.UUID) -> list[uuid.UUID]:
    stmt = (
        select(VisitorSelectionItem.document_id)
        .where(VisitorSelectionItem.selection_id == selection_id)
        .order_by(VisitorSelectionItem.created_at)
    )
    return list(session.scalars(stmt))


def add_selection_item(session: Session, selection_id: uuid.UUID, document_id: uuid.UUID) -> None:
    session.execute(
        insert(VisitorSelectionItem).values(selection_id=selection_id, document_id=document_id).on_conflict_do_nothing()
    )


def remove_selection_item(session: Session, selection_id: uuid.UUID, document_id: uuid.UUID) -> None:
    session.execute(
        delete(VisitorSelectionItem).where(
            VisitorSelectionItem.selection_id == selection_id, VisitorSelectionItem.document_id == document_id
        )
    )


# search history
def searches(session: Session, visitor_id: uuid.UUID, limit: int) -> list[VisitorSearch]:
    stmt = (
        select(VisitorSearch)
        .where(VisitorSearch.visitor_id == visitor_id)
        .order_by(VisitorSearch.created_at.desc(), VisitorSearch.id)
        .limit(limit)
    )
    return list(session.scalars(stmt))


def trim_searches(session: Session, visitor_id: uuid.UUID, keep: int) -> None:
    old = (
        select(VisitorSearch.id)
        .where(VisitorSearch.visitor_id == visitor_id)
        .order_by(VisitorSearch.created_at.desc(), VisitorSearch.id)
        .offset(keep)
    )
    session.execute(delete(VisitorSearch).where(VisitorSearch.id.in_(old)))


# subscriptions
def topics(session: Session, visitor_id: uuid.UUID) -> list[str]:
    stmt = select(VisitorSubscription.topic).where(VisitorSubscription.visitor_id == visitor_id).order_by(VisitorSubscription.topic)
    return list(session.scalars(stmt))
