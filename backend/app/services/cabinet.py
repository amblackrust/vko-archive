"""Visitor cabinet (T5.18): favorites, personal selections, search history, subscriptions.

Every operation takes the authenticated visitor and touches only that visitor's rows; objects
are added only if they are public for anonymous visitors right now, and are re-checked on read
(an unpublished or closed item silently drops out of the lists). Nothing here grants access to
anything: file and card access still go through the public, anonymous checks."""

import uuid
from urllib.parse import quote

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Visitor, VisitorSearch, VisitorSelection, VisitorSubscription
from app.repositories import cabinet as repo
from app.repositories import catalog as catalog_repo
from app.repositories import exhibitions as exhibitions_repo
from app.repositories import news as news_repo
from app.schemas.cabinet import (
    FavoriteItem,
    SearchEntry,
    Selection,
    SelectionDocument,
    Subscriptions,
)
from app.services.catalog import pick
from app.services.errors import Conflict, InvalidInput, NotFound

MAX_FAVORITES = 200
MAX_SELECTIONS = 20
MAX_SELECTION_DOCUMENTS = 100
MAX_SEARCHES = 50


def _public_object(session: Session, object_type: str, object_id: uuid.UUID, lang: str) -> FavoriteItem | None:
    if object_type == "document":
        row = catalog_repo.get_public_document(session, object_id)
        if row is None:
            return None
        doc = row.Document
        return FavoriteItem(type="document", id=doc.id, title=pick(doc.title, lang)[0],
                            href=f"/catalog/documents/{doc.id}", is_demo=doc.is_demo)
    if object_type == "exhibition":
        ex = exhibitions_repo.published_by_id(session, object_id)
        if ex is None:
            return None
        return FavoriteItem(type="exhibition", id=ex.id, title=pick(ex.title, lang)[0],
                            href=f"/exhibitions/{ex.slug}", is_demo=ex.is_demo)
    news = news_repo.published_by_id(session, object_id)
    if news is None:
        return None
    return FavoriteItem(type="news", id=news.id, title=pick(news.title, lang)[0],
                        href=f"/news/{news.slug}", is_demo=news.is_demo)


def list_favorites(session: Session, visitor: Visitor, lang: str) -> list[FavoriteItem]:
    items = (_public_object(session, f.object_type, f.object_id, lang) for f in repo.favorites(session, visitor.id))
    return [item for item in items if item is not None]


def is_favorite(session: Session, visitor: Visitor, object_type: str, object_id: uuid.UUID) -> bool:
    return repo.has_favorite(session, visitor.id, object_type, object_id)


def add_favorite(session: Session, visitor: Visitor, object_type: str, object_id: uuid.UUID) -> None:
    if _public_object(session, object_type, object_id, "ru") is None:
        raise NotFound()
    if not repo.has_favorite(session, visitor.id, object_type, object_id) and repo.count_favorites(session, visitor.id) >= MAX_FAVORITES:
        raise Conflict("limit_reached")
    repo.add_favorite(session, visitor.id, object_type, object_id)
    session.commit()


def remove_favorite(session: Session, visitor: Visitor, object_type: str, object_id: uuid.UUID) -> None:
    repo.remove_favorite(session, visitor.id, object_type, object_id)
    session.commit()


def list_selections(session: Session, visitor: Visitor, lang: str) -> list[Selection]:
    out = []
    for selection in repo.selections(session, visitor.id):
        documents = []
        for document_id in repo.selection_document_ids(session, selection.id):
            row = catalog_repo.get_public_document(session, document_id)
            if row is not None:
                doc = row.Document
                documents.append(SelectionDocument(id=doc.id, title=pick(doc.title, lang)[0],
                                                   href=f"/catalog/documents/{doc.id}", archive_code=doc.archive_code))
        out.append(Selection(id=selection.id, title=selection.title, documents=documents))
    return out


def create_selection(session: Session, visitor: Visitor, title: str) -> Selection:
    title = " ".join(title.split())
    if not title:
        raise InvalidInput("title_required")
    if repo.count_selections(session, visitor.id) >= MAX_SELECTIONS:
        raise Conflict("limit_reached")
    selection = VisitorSelection(visitor_id=visitor.id, title=title)
    session.add(selection)
    session.commit()
    return Selection(id=selection.id, title=selection.title, documents=[])


def delete_selection(session: Session, visitor: Visitor, selection_id: uuid.UUID) -> None:
    selection = repo.own_selection(session, visitor.id, selection_id)
    if selection is None:
        raise NotFound()
    session.delete(selection)
    session.commit()


def add_to_selection(session: Session, visitor: Visitor, selection_id: uuid.UUID, document_id: uuid.UUID) -> None:
    selection = repo.own_selection(session, visitor.id, selection_id)
    if selection is None or catalog_repo.get_public_document(session, document_id) is None:
        raise NotFound()
    if document_id not in (ids := repo.selection_document_ids(session, selection.id)) and len(ids) >= MAX_SELECTION_DOCUMENTS:
        raise Conflict("limit_reached")
    repo.add_selection_item(session, selection.id, document_id)
    session.commit()


def remove_from_selection(session: Session, visitor: Visitor, selection_id: uuid.UUID, document_id: uuid.UUID) -> None:
    selection = repo.own_selection(session, visitor.id, selection_id)
    if selection is None:
        raise NotFound()
    repo.remove_selection_item(session, selection.id, document_id)
    session.commit()


def list_searches(session: Session, visitor: Visitor) -> list[SearchEntry]:
    return [
        SearchEntry(id=s.id, query=s.query, href=f"/search?q={quote(s.query)}")
        for s in repo.searches(session, visitor.id, MAX_SEARCHES)
    ]


def add_search(session: Session, visitor: Visitor, query: str) -> None:
    query = " ".join(query.split())
    if not query:
        raise InvalidInput("query_required")
    latest = repo.searches(session, visitor.id, 1)
    if not latest or latest[0].query != query:
        session.add(VisitorSearch(visitor_id=visitor.id, query=query))
        session.flush()
        repo.trim_searches(session, visitor.id, MAX_SEARCHES)
    session.commit()


def delete_search(session: Session, visitor: Visitor, search_id: uuid.UUID) -> None:
    session.execute(delete(VisitorSearch).where(VisitorSearch.id == search_id, VisitorSearch.visitor_id == visitor.id))
    session.commit()


def clear_searches(session: Session, visitor: Visitor) -> None:
    session.execute(delete(VisitorSearch).where(VisitorSearch.visitor_id == visitor.id))
    session.commit()


def get_subscriptions(session: Session, visitor: Visitor) -> Subscriptions:
    return Subscriptions(topics=repo.topics(session, visitor.id))


def set_subscription(session: Session, visitor: Visitor, topic: str, on: bool) -> Subscriptions:
    if on:
        session.execute(insert(VisitorSubscription).values(visitor_id=visitor.id, topic=topic).on_conflict_do_nothing())
    else:
        session.execute(
            delete(VisitorSubscription).where(VisitorSubscription.visitor_id == visitor.id, VisitorSubscription.topic == topic)
        )
    session.commit()
    return get_subscriptions(session, visitor)


def delete_account(session: Session, visitor: Visitor) -> None:
    session.delete(visitor)  # favorites, selections, searches, subscriptions cascade
    session.commit()
