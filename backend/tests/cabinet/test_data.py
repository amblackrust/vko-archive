"""Cabinet data (T5.18): favorites, selections, search history, subscriptions — owner scoping
and public-only objects."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.models.enums import DescriptionStatus, FileAccess, WorkflowStatus
from tests.cabinet.conftest import exhibition, news, public_document, register

CAB = "/api/cabinet"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/favorites"), ("POST", "/favorites"), ("GET", "/selections"), ("POST", "/selections"),
        ("GET", "/searches"), ("DELETE", "/searches"), ("GET", "/subscriptions"), ("PUT", "/subscriptions/news"),
        ("DELETE", "/me"),
    ],
)
def test_everything_requires_a_session(api: TestClient, method: str, path: str) -> None:
    assert api.request(method, CAB + path, json={}).status_code == 401


def test_favorites_roundtrip_and_public_only(api: TestClient, factory) -> None:
    register(api)
    doc = public_document(factory)
    ex = exhibition(factory)
    item = news(factory)
    for kind, obj in (("document", doc), ("exhibition", ex), ("news", item)):
        assert api.post(f"{CAB}/favorites", json={"type": kind, "id": str(obj.id)}).status_code == 204
    api.post(f"{CAB}/favorites", json={"type": "document", "id": str(doc.id)})  # idempotent
    listed = api.get(f"{CAB}/favorites").json()
    assert {(f["type"], f["id"]) for f in listed} == {("document", str(doc.id)), ("exhibition", str(ex.id)), ("news", str(item.id))}
    assert api.get(f"{CAB}/favorites/check", params={"type": "document", "id": str(doc.id)}).json() == {"favorite": True}
    assert api.delete(f"{CAB}/favorites/document/{doc.id}").status_code == 204
    assert api.get(f"{CAB}/favorites/check", params={"type": "document", "id": str(doc.id)}).json() == {"favorite": False}


def test_non_public_objects_cannot_be_saved_and_drop_out(api: TestClient, factory, engine) -> None:
    register(api)
    draft = factory.document()
    closed = public_document(factory, description_status=DescriptionStatus.DO_NOT_PUBLISH)
    for obj in (draft, closed):
        assert api.post(f"{CAB}/favorites", json={"type": "document", "id": str(obj.id)}).status_code == 404
    assert api.post(f"{CAB}/favorites", json={"type": "news", "id": str(uuid.uuid4())}).status_code == 404
    assert api.post(f"{CAB}/favorites", json={"type": "bogus", "id": str(uuid.uuid4())}).status_code == 422
    # A saved item that is later unpublished disappears from the list.
    doc = public_document(factory)
    api.post(f"{CAB}/favorites", json={"type": "document", "id": str(doc.id)})
    doc.workflow_status = WorkflowStatus.DRAFT
    factory.session.commit()
    assert api.get(f"{CAB}/favorites").json() == []


def test_visitors_are_isolated(api: TestClient, second_client: TestClient, factory) -> None:
    register(api)
    doc = public_document(factory)
    api.post(f"{CAB}/favorites", json={"type": "document", "id": str(doc.id)})
    selection = api.post(f"{CAB}/selections", json={"title": "Моя подборка"}).json()
    api.post(f"{CAB}/selections/{selection['id']}/items", json={"document_id": str(doc.id)})
    api.post(f"{CAB}/searches", json={"query": "Усть-Каменогорск"})
    api.put(f"{CAB}/subscriptions/news")

    register(second_client)
    assert second_client.get(f"{CAB}/favorites").json() == []
    assert second_client.get(f"{CAB}/selections").json() == []
    assert second_client.get(f"{CAB}/searches").json() == []
    assert second_client.get(f"{CAB}/subscriptions").json()["topics"] == []
    assert second_client.get(f"{CAB}/favorites/check", params={"type": "document", "id": str(doc.id)}).json() == {"favorite": False}
    # IDOR: someone else's selection id is indistinguishable from a missing one.
    assert second_client.post(f"{CAB}/selections/{selection['id']}/items", json={"document_id": str(doc.id)}).status_code == 404
    assert second_client.delete(f"{CAB}/selections/{selection['id']}/items/{doc.id}").status_code == 404
    assert second_client.delete(f"{CAB}/selections/{selection['id']}").status_code == 404
    second_client.delete(f"{CAB}/searches")
    second_client.delete(f"{CAB}/favorites/document/{doc.id}")
    assert len(api.get(f"{CAB}/searches").json()) == 1
    assert len(api.get(f"{CAB}/favorites").json()) == 1
    assert api.get(f"{CAB}/selections").json()[0]["documents"][0]["id"] == str(doc.id)


def test_selections_documents_must_be_public(api: TestClient, factory) -> None:
    register(api)
    selection = api.post(f"{CAB}/selections", json={"title": "  Подборка  "}).json()
    assert selection["title"] == "Подборка"
    assert api.post(f"{CAB}/selections", json={"title": "   "}).status_code == 422
    draft = factory.document()
    assert api.post(f"{CAB}/selections/{selection['id']}/items", json={"document_id": str(draft.id)}).status_code == 404
    doc = public_document(factory)
    assert api.post(f"{CAB}/selections/{selection['id']}/items", json={"document_id": str(doc.id)}).status_code == 204
    assert api.delete(f"{CAB}/selections/{selection['id']}/items/{doc.id}").status_code == 204
    assert api.get(f"{CAB}/selections").json()[0]["documents"] == []
    assert api.delete(f"{CAB}/selections/{selection['id']}").status_code == 204
    assert api.get(f"{CAB}/selections").json() == []


def test_search_history_can_be_cleared(api: TestClient) -> None:
    register(api)
    for q in ("архив", "архив", "<script>x</script>", "фонд"):
        assert api.post(f"{CAB}/searches", json={"query": q}).status_code == 204
    history = api.get(f"{CAB}/searches").json()
    assert [h["query"] for h in history] == ["фонд", "<script>x</script>", "архив"]  # repeats collapse
    assert history[1]["href"] == "/search?q=%3Cscript%3Ex%3C/script%3E"
    assert api.post(f"{CAB}/searches", json={"query": " "}).status_code == 422
    assert api.delete(f"{CAB}/searches/{history[0]['id']}").status_code == 204
    assert api.delete(f"{CAB}/searches").status_code == 204
    assert api.get(f"{CAB}/searches").json() == []


def test_subscriptions_toggle(api: TestClient) -> None:
    register(api)
    assert api.put(f"{CAB}/subscriptions/news").json()["topics"] == ["news"]
    api.put(f"{CAB}/subscriptions/news")
    assert api.put(f"{CAB}/subscriptions/exhibitions").json()["topics"] == ["exhibitions", "news"]
    assert api.delete(f"{CAB}/subscriptions/news").json()["topics"] == ["exhibitions"]
    assert api.put(f"{CAB}/subscriptions/spam").status_code == 422


def test_visitor_does_not_unlock_closed_files(api: TestClient, factory) -> None:
    from tests.cabinet.conftest import document_file

    register(api)
    doc = public_document(factory, file_access=FileAccess.CLOSED)
    file = document_file(factory, doc)
    assert api.get(f"/api/files/{file.id}").status_code == 404
