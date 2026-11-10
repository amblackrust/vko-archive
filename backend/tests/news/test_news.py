"""Public news (T5.14): published only, sanitized body, safe media and related links."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.models.enums import WorkflowStatus
from tests.cabinet.conftest import document_file, exhibition, news, public_document

XSS_BODY = '<p onclick="alert(1)">Текст</p><script>alert(1)</script><a href="javascript:alert(2)">x</a>'


def test_list_category_search_sort_and_pagination(api: TestClient, factory) -> None:
    now = datetime.now(UTC)
    old = news(factory, category="cat-zz", title={"ru": "Старая Зюзя"}, published_at=now - timedelta(days=5))
    new = news(factory, category="cat-zz", title={"ru": "Свежая Зюзя"}, published_at=now - timedelta(days=1))
    news(factory, category="cat-zz", title={"ru": "Черновик Зюзя"}, workflow_status=WorkflowStatus.DRAFT)
    other = news(factory, category="cat-yy", title={"ru": "Иная"}, published_at=now)
    ids = lambda **p: [i["id"] for i in api.get("/api/news", params={"category": "cat-zz", **p}).json()["items"]]  # noqa: E731
    assert ids() == [str(new.id), str(old.id)]
    assert ids(sort="date_asc") == [str(old.id), str(new.id)]
    assert ids(q="свежая") == [str(new.id)]
    page = api.get("/api/news", params={"category": "cat-zz", "per_page": 1, "page": 2}).json()
    assert page["total"] == 2 and page["pages"] == 2 and [i["id"] for i in page["items"]] == [str(old.id)]
    assert {"cat-zz", "cat-yy"} <= set(page["categories"])
    assert str(other.id) not in ids()
    assert api.get("/api/news", params={"sort": "random"}).status_code == 422
    assert api.get("/api/news", params={"per_page": 500}).status_code == 422


def test_detail_sanitizes_body_and_filters_media_and_related(api: TestClient, factory) -> None:
    doc = public_document(factory)
    open_file = document_file(factory, doc)
    draft_doc = factory.document()
    ex = exhibition(factory)
    item = news(
        factory,
        body={"ru": XSS_BODY},
        cover_file_id=open_file.id,
        media=[{"url": "https://example.kz/v"}, {"url": "javascript:alert(1)"}, {"file_id": "not-a-uuid"}, {"file_id": str(open_file.id)}],
        related=[
            {"type": "document", "id": str(doc.id)},
            {"type": "document", "id": str(draft_doc.id)},
            {"type": "exhibition", "id": str(ex.id)},
            {"type": "unknown", "id": str(doc.id)},
            {"type": "news", "id": "garbage"},
        ],
    )
    body = api.get(f"/api/news/{item.slug}").json()
    assert "<script" not in body["body"] and "onclick" not in body["body"] and "javascript:" not in body["body"]
    assert "Текст" in body["body"]
    assert body["cover"]["url"] == f"/api/files/{open_file.id}"
    assert [(m["url"], bool(m["file"])) for m in body["media"]] == [("https://example.kz/v", False), (None, True)]
    assert {(r["type"], r["href"]) for r in body["related"]} == {
        ("document", f"/catalog/documents/{doc.id}"), ("exhibition", f"/exhibitions/{ex.slug}")
    }


def test_unpublished_or_unknown_is_404(api: TestClient, factory) -> None:
    draft = news(factory, workflow_status=WorkflowStatus.DRAFT)
    assert api.get(f"/api/news/{draft.slug}").status_code == 404
    assert api.get("/api/news/nothing-here").status_code == 404
