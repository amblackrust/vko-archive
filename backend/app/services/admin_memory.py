"""Admin «Архив памяти» (T6.9): collections (+ ordered items), persons and chronology events (+ linked
documents, sources). Same engine as the rest of the CMS (`admin_content`): authorize, save_with_version,
audit, re-index. Links to documents require `catalog.view` on the document."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Collection, CollectionItem, Document, HistoricalEvent, Person
from app.models.enums import AuditResult
from app.schemas.admin_cms import CollectionIn, CollectionItemsIn, DocumentLinksIn, EventIn, PersonIn
from app.services import admin_common as common
from app.services import admin_content as content
from app.services import audit, workflow
from app.services.admin_content import Kind
from app.services.authz import AuthUser, require
from app.services.errors import InvalidInput, NotFound

ITEM_MODELS: dict[str, type] = {"document": Document, "person": Person, "historical_event": HistoricalEvent}


def _items(session: Session, obj: Collection) -> dict[str, Any]:
    return {
        "items": [
            {"item_type": i.item_type, "item_id": str(i.item_id), "note": i.note or {}}
            for i in obj.items
        ]
    }


def _document_ids(session: Session, obj: Any) -> dict[str, Any]:
    return {"document_ids": [str(d.id) for d in sorted(obj.documents, key=lambda d: d.archive_code or "")]}


def _referenced(session: Session, item_type: str, object_id: uuid.UUID) -> bool:
    stmt = select(CollectionItem.id).where(CollectionItem.item_type == item_type, CollectionItem.item_id == object_id).limit(1)
    return session.scalar(stmt) is not None


def _blocked_by_collections(item_type: str):
    return lambda session, obj: "has_children" if _referenced(session, item_type, obj.id) else None


MEMORY_KINDS = {
    "collection": Kind(
        content.Spec("collection", Collection, CollectionIn, "content", text_required=("title",)),
        lambda o: o.title, lambda o: o.slug, ("slug", "title", "theme"), ("-updated_at",),
        extra=lambda o: {"theme": o.theme}, files={"cover_file_id": "collection"}, extra_values=_items,
    ),
    "person": Kind(
        content.Spec("person", Person, PersonIn, "content", text_required=("name",)),
        lambda o: o.name, lambda o: o.slug, ("slug", "name"), ("-updated_at",),
        extra=lambda o: {"years": o.years_text}, files={"photo_file_id": "person"}, extra_values=_document_ids,
        blockers=_blocked_by_collections("person"),
    ),
    "historical_event": Kind(
        content.Spec("historical_event", HistoricalEvent, EventIn, "content", text_required=("title",)),
        lambda o: o.title, lambda o: o.slug, ("slug", "title", "date_text", "theme"), ("-date_from", "-updated_at"),
        extra=lambda o: {"date": o.date_text, "theme": o.theme}, extra_values=_document_ids,
        blockers=_blocked_by_collections("historical_event"),
    ),
}
content.register(MEMORY_KINDS)


def set_items(session: Session, user: AuthUser, collection_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    """Replaces the collection's items (order = list order). One new version, one audit record."""
    collection = common.load(session, MEMORY_KINDS["collection"].spec, collection_id)
    require(session, user, "content.edit", collection, ip=ip)
    data = common.parse(CollectionItemsIn, body)
    if "version" not in data or "items" not in data:
        raise InvalidInput("invalid_input")
    items = data["items"]
    seen = set()
    for item in items:
        key = (item.item_type, item.item_id)
        if key in seen:
            raise InvalidInput("duplicate_item")
        seen.add(key)
        target = session.get(ITEM_MODELS[item.item_type], item.item_id)
        if target is None:
            raise InvalidInput("unknown_link")
        if item.item_type == "document":
            require(session, user, "catalog.view", target, ip=ip)
    workflow.save_with_version(session, user, "collection", collection, data["version"], {}, ip=ip)
    collection.items.clear()
    session.flush()
    for position, item in enumerate(items):
        collection.items.append(CollectionItem(position=position, item_type=item.item_type, item_id=item.item_id, note=item.note))
    audit.record(
        session, action_type="collection.items", result=AuditResult.SUCCESS, user=user,
        object_type="collection", object_id=collection.id, details={"count": len(items)}, ip=ip,
    )
    session.commit()
    return content.get(session, user, "collection", collection_id, ip=ip)


def set_documents(
    session: Session, user: AuthUser, name: str, object_id: uuid.UUID, body: dict[str, Any], *, ip: str | None
) -> dict[str, Any]:
    if name not in ("person", "historical_event"):
        raise NotFound()
    obj = common.load(session, MEMORY_KINDS[name].spec, object_id)
    require(session, user, "content.edit", obj, ip=ip)
    data = common.parse(DocumentLinksIn, body)
    if "version" not in data or "document_ids" not in data:
        raise InvalidInput("invalid_input")
    ids = data["document_ids"]
    if len(ids) != len(set(ids)):
        raise InvalidInput("duplicate_item")
    documents = []
    for ident in ids:
        document = session.get(Document, ident)
        if document is None:
            raise InvalidInput("unknown_link")
        require(session, user, "catalog.view", document, ip=ip)
        documents.append(document)
    workflow.save_with_version(session, user, name, obj, data["version"], {}, ip=ip)
    obj.documents = documents
    audit.record(
        session, action_type=f"{name}.documents", result=AuditResult.SUCCESS, user=user,
        object_type=name, object_id=obj.id, details={"count": len(ids)}, ip=ip,
    )
    session.commit()
    return content.get(session, user, name, object_id, ip=ip)
