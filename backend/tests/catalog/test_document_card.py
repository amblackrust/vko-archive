"""T3.5/T3.6: `GET /api/catalog/documents/{id}` -- public card, files only as /api/files URLs."""

import uuid

import pytest
from sqlalchemy import delete

from app.models import Document, SearchLog, Tag
from app.models.enums import DescriptionStatus, FileAccess, WorkflowStatus
from tests.catalog.conftest import doc, published_tree, token
from tests.search.conftest import add_file


def card(api, document_id, **params):
    return api.get(f"/api/catalog/documents/{document_id}", params=params)


def test_public_card_has_fields_files_and_related(api, factory):
    word = token()
    _, _, case = published_tree(factory)
    tag = factory.add(Tag(name={"ru": f"ДЕМО тема {word}"}, workflow_status=WorkflowStatus.PUBLISHED))
    hidden_tag = factory.add(Tag(name={"ru": "ДЕМО скрытая"}, workflow_status=WorkflowStatus.DRAFT))
    main = doc(
        factory, case, word, archive_code=f"Ф-1/Оп-1/Д-1/{word}", historical_note={"ru": "Справка"},
        summary={"ru": "Описание"}, storage_location="Зал 1", has_digital_copy=True, sheets_count=2,
    )
    main.tags = [tag, hidden_tag]
    factory.session.commit()
    sibling = doc(factory, case, word)
    hidden_sibling = doc(factory, case, word, workflow_status=WorkflowStatus.DRAFT)
    second = add_file(factory, main, position=2, master_path="masters/secret/b.png", mime="image/png",
                      ocr_text="текст страницы", preview_path="previews/secret/b.jpg")
    first = add_file(factory, main, position=1, master_path="masters/secret/a.png", mime="image/png")

    response = card(api, main.id)
    assert response.status_code == 200
    body = response.json()
    assert body["historical_note"] == "Справка" and body["storage_location"] == "Зал 1"
    assert [t["name"] for t in body["tags"]] == [f"ДЕМО тема {word}"]  # unpublished tag hidden
    assert [f["id"] for f in body["files"]] == [str(first.id), str(second.id)]
    assert body["files"][1]["ocr_text"] == "текст страницы"
    assert body["files"][1]["preview_url"] == f"/api/files/{second.id}?variant=preview"
    assert [r["id"] for r in body["related"]] == [str(sibling.id)]
    assert str(hidden_sibling.id) not in response.text
    assert "secret" not in response.text and "master_path" not in response.text
    assert response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize("access", [FileAccess.RESTRICTED, FileAccess.CLOSED, FileAccess.NEEDS_REVIEW])
def test_restricted_card_has_conditions_but_no_files(api, factory, access):
    document = doc(factory, None, token(), file_access=access, access_conditions={"ru": "Только в читальном зале"})
    add_file(factory, document, master_path="masters/secret/x.png", mime="image/png")
    body = card(api, document.id).json()
    assert body["file_access"] == access.value and body["access_conditions"] == "Только в читальном зале"
    assert body["files"] == []
    assert "secret" not in str(body)


def test_closed_file_of_open_document_is_not_listed(api, factory):
    document = doc(factory, None, token())
    add_file(factory, document, access=FileAccess.CLOSED)
    assert card(api, document.id).json()["files"] == []


@pytest.mark.parametrize(
    "values",
    [
        {"workflow_status": WorkflowStatus.DRAFT},
        {"workflow_status": WorkflowStatus.ARCHIVED},
        {"description_status": DescriptionStatus.DO_NOT_PUBLISH},
        {"description_status": DescriptionStatus.NEEDS_REVIEW},
    ],
)
def test_hidden_document_is_404_without_details(api, factory, values):
    document = doc(factory, None, token(), **values)
    response = card(api, document.id)
    assert response.status_code == 404 and document.title["ru"] not in response.text


def test_unknown_and_malformed_ids(api):
    assert card(api, uuid.uuid4()).status_code == 404
    assert card(api, "not-a-uuid").status_code == 422
    assert card(api, uuid.uuid4(), lang="de").status_code == 422


def test_title_falls_back_to_other_language(api, factory):
    document = doc(factory, None, token())
    body = card(api, document.id, lang="en").json()
    assert body["title"] == document.title["ru"] and body["title_lang"] == "ru"


@pytest.fixture
def cleanup_logs(engine):
    from sqlalchemy.orm import Session

    marker = token()
    yield marker
    with Session(engine) as session:
        session.execute(delete(SearchLog).where(SearchLog.query.like(f"%{marker}%")))
        session.commit()


def _logs(engine, marker):
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    with Session(engine) as session:
        return list(session.scalars(select(SearchLog).where(SearchLog.query.like(f"%{marker}%"))))


def test_search_log_marks_zero_results(api, factory, engine, cleanup_logs):
    marker = cleanup_logs
    assert api.get("/api/search", params={"q": marker}).json()["total"] == 0
    doc(factory, None, marker)
    factory.session.commit()
    api.get("/api/catalog/documents", params={"q": marker})
    api.get("/api/catalog/documents", params={"q": marker, "page": 2})  # paging is not logged
    rows = sorted(_logs(engine, marker), key=lambda r: r.id)
    assert [(r.source, r.zero_result, r.results_count) for r in rows] == [("search", True, 0), ("catalog", False, 1)]
    assert all(r.lang == "ru" for r in rows)


def test_catalog_zero_result_without_text_is_logged(api, engine):
    before = len(_logs(engine, ""))
    assert api.get("/api/catalog/documents", params={"fund_number": "no-such-fund-" + token()}).json()["total"] == 0
    assert len(_logs(engine, "")) == before + 1
