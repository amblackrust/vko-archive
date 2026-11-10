"""Public online exhibitions (T5.13): published only, files and card links follow document access."""

import uuid

from fastapi.testclient import TestClient

from app.models import Exhibit
from app.models.enums import FileAccess, WorkflowStatus
from tests.cabinet.conftest import document_file, exhibition, public_document

PUBLISHED = WorkflowStatus.PUBLISHED


def _exhibit(factory, ex, position: int, **values) -> Exhibit:
    values.setdefault("workflow_status", PUBLISHED)
    return factory.add(
        Exhibit(exhibition_id=ex.id, position=position, slug=f"x-{uuid.uuid4().hex[:8]}", title={"ru": f"Экспонат {position}"},
                caption={"ru": "Подпись"}, source={"ru": "Источник"}, is_demo=True, **values)
    )


def test_list_filters_and_hides_drafts(api: TestClient, factory) -> None:
    a = exhibition(factory, theme="t-industry-x", period="1950-е")
    b = exhibition(factory, theme="t-education-x", period="1960-е", title={"ru": "Школы региона"})
    draft = exhibition(factory, theme="t-industry-x", workflow_status=WorkflowStatus.DRAFT)
    ids = {i["id"] for i in api.get("/api/exhibitions", params={"theme": "t-industry-x"}).json()["items"]}
    assert ids == {str(a.id)}  # the draft is not listed
    assert str(draft.id) not in {i["id"] for i in api.get("/api/exhibitions").json()["items"]}
    body = api.get("/api/exhibitions", params={"period": "1960-е", "q": "школы"}).json()
    assert [i["id"] for i in body["items"]] == [str(b.id)] and body["total"] == 1
    assert "t-education-x" in body["themes"] and "1950-е" in body["periods"]
    assert "t-industry-x" in api.get("/api/exhibitions").json()["themes"]
    assert api.get("/api/exhibitions", params={"lang": "xx"}).status_code == 422


def test_detail_orders_exhibits_and_guards_files_and_links(api: TestClient, factory) -> None:
    ex = exhibition(factory)
    open_doc = public_document(factory)
    open_file = document_file(factory, open_doc)
    closed_doc = public_document(factory, file_access=FileAccess.CLOSED)
    closed_file = document_file(factory, closed_doc)
    hidden_doc = factory.document()  # draft
    _exhibit(factory, ex, 2, document_id=closed_doc.id, media_file_id=closed_file.id, media_url="javascript:alert(1)")
    _exhibit(factory, ex, 1, document_id=open_doc.id, media_file_id=open_file.id, media_url="https://example.kz/video")
    _exhibit(factory, ex, 3, document_id=hidden_doc.id)
    _exhibit(factory, ex, 4, workflow_status=WorkflowStatus.DRAFT)
    response = api.get(f"/api/exhibitions/{ex.slug}")
    assert response.status_code == 200
    body = response.json()
    exhibits = body["exhibits"]
    assert [e["title"] for e in exhibits] == ["Экспонат 1", "Экспонат 2", "Экспонат 3"] and body["exhibits_count"] == 3
    assert [e["position"] for e in exhibits] == [1, 2, 3]
    assert exhibits[0]["media"]["url"] == f"/api/files/{open_file.id}" and exhibits[0]["video_url"] == "https://example.kz/video"
    assert exhibits[0]["document_href"] == f"/catalog/documents/{open_doc.id}"
    assert exhibits[1]["media"] is None and exhibits[1]["video_url"] is None  # closed file, unsafe link
    assert exhibits[1]["document_href"] == f"/catalog/documents/{closed_doc.id}"  # the card itself is public
    assert exhibits[2]["document_href"] is None
    assert "master_path" not in response.text and "x/master.jpg" not in response.text
    assert api.get(f"/api/files/{closed_file.id}").status_code == 404


def test_unpublished_or_unknown_is_404(api: TestClient, factory) -> None:
    draft = exhibition(factory, workflow_status=WorkflowStatus.DRAFT)
    assert api.get(f"/api/exhibitions/{draft.slug}").status_code == 404
    assert api.get("/api/exhibitions/no-such-exhibition").status_code == 404
    assert api.get("/api/exhibitions/Bad_Slug").status_code == 422
