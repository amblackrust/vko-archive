import uuid

from sqlalchemy import delete

from app.models import Collection, HistoricalEvent, Person, WorkflowHistory
from app.models.enums import RoleCode
from tests.admin.conftest import login

URL = "/api/admin"


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _slug() -> str:
    return f"demo-{uuid.uuid4().hex[:8]}"


def _drop(factory, model, object_id):
    s = factory.session
    s.rollback()
    s.execute(delete(WorkflowHistory).where(WorkflowHistory.object_id == uuid.UUID(object_id)))
    s.delete(s.get(model, uuid.UUID(object_id)))
    s.commit()


def test_collection_items_and_person_documents(api, factory):
    _, _, case = factory.catalog(None)
    document = factory.document(case)
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    person = api.post(
        f"{URL}/memory/person",
        json={"slug": _slug(), "name": {"ru": "ДЕМО Личность"}, "is_demo": True, "sources": [{"title": "Источник", "url": "https://example.org"}, {"title": "Без ссылки", "url": None}]},
    )
    assert person.status_code == 201, person.text
    pid = person.json()["id"]
    assert person.json()["values"]["sources"] == [{"title": "Источник", "url": "https://example.org/"}] or person.json()["values"]["sources"][0]["title"] == "Источник"
    assert api.post(f"{URL}/memory/person", json={"slug": _slug(), "name": {"ru": "x"}, "sources": [{"title": "t", "url": "javascript:1"}]}).status_code == 422

    linked = api.put(f"{URL}/memory/person/{pid}/documents", json={"version": 1, "document_ids": [str(document.id)]})
    assert linked.status_code == 200, linked.text
    assert linked.json()["values"]["document_ids"] == [str(document.id)] and linked.json()["version"] == 2
    assert api.put(f"{URL}/memory/person/{pid}/documents", json={"version": 1, "document_ids": []}).status_code == 409
    assert api.put(f"{URL}/memory/person/{pid}/documents", json={"version": 2, "document_ids": [str(uuid.uuid4())]}).json()["detail"] == "unknown_link"
    assert api.put(f"{URL}/memory/collection/{pid}/documents", json={"version": 1, "document_ids": []}).status_code == 404

    collection = api.post(f"{URL}/memory/collection", json={"slug": _slug(), "title": {"ru": "ДЕМО коллекция"}, "is_demo": True})
    cid = collection.json()["id"]
    items = [{"item_type": "document", "item_id": str(document.id), "note": {"ru": "заметка"}}, {"item_type": "person", "item_id": pid}]
    done = api.put(f"{URL}/memory/collection/{cid}/items", json={"version": 1, "items": items})
    assert done.status_code == 200, done.text
    assert [i["item_type"] for i in done.json()["values"]["items"]] == ["document", "person"]
    dup = api.put(f"{URL}/memory/collection/{cid}/items", json={"version": 2, "items": items + items[:1]})
    assert dup.json()["detail"] == "duplicate_item"
    reordered = api.put(f"{URL}/memory/collection/{cid}/items", json={"version": 2, "items": items[::-1]})
    assert [i["item_type"] for i in reordered.json()["values"]["items"]] == ["person", "document"]
    # A person that a collection refers to cannot be deleted (only admins could; drafts of editors cannot anyway).
    assert api.delete(f"{URL}/memory/person/{pid}").status_code == 403
    admin = factory.user(RoleCode.SUPER_ADMIN)
    _as(api, admin)
    assert api.delete(f"{URL}/memory/person/{pid}").json()["detail"] == "has_children"
    _drop(factory, Collection, cid)
    assert api.delete(f"{URL}/memory/person/{pid}").status_code == 204
    factory.session.rollback()


def test_event_range_and_coordinates(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    base = {"slug": _slug(), "title": {"ru": "ДЕМО событие"}, "is_demo": True}
    assert api.post(f"{URL}/memory/historical_event", json={**base, "date_from": "1950-01-01", "date_to": "1940-01-01"}).json()["detail"] == "invalid_range"
    assert api.post(f"{URL}/memory/historical_event", json={**base, "lat": 120, "lng": 10}).status_code == 422
    ok = api.post(f"{URL}/memory/historical_event", json={**base, "date_from": "1940-01-01", "lat": 49.95, "lng": 82.6})
    assert ok.status_code == 201, ok.text
    other = factory.user(RoleCode.ANALYST)
    _as(api, other)
    assert api.get(f"{URL}/memory/historical_event/{ok.json()['id']}").status_code == 403
    _drop(factory, HistoricalEvent, ok.json()["id"])
