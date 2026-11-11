"""Staff AI tools (T4.9, T4.10): proposals only, explicit apply, public annotation guards.
The model is always a stub: no test reaches a real Ollama."""

import json
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.ai import embeddings, ollama_client, tools_ocr
from app.config import Settings, get_settings
from app.main import app
from app.models import DigitalFile, DocumentAnnotation, Tag
from app.models.enums import FileAccess, OcrStatus, RoleCode, WorkflowStatus
from tests.admin.conftest import login
from tests.search.conftest import add_file, factory, public_document  # noqa: F401  (fixtures/helpers)

BASE = "/api/admin/ai-tools"
SECRET = "СЕКРЕТНАЯ-ЗАКРЫТАЯ-ФРАЗА"


class Model:
    """Stub of ollama_client: records prompts, answers with `reply`."""

    def __init__(self) -> None:
        self.reply = ""
        self.prompts: list[str] = []

    def chat(self, messages, settings, *, fmt=None, timeout=None):
        self.prompts.append("\n".join(m["content"] for m in messages))
        return self.reply


@pytest.fixture
def model(monkeypatch):
    stub = Model()
    monkeypatch.setattr(ollama_client, "chat", stub.chat)
    monkeypatch.setattr(ollama_client, "availability", lambda settings: ollama_client.Availability(True))
    monkeypatch.setattr(
        embeddings, "embed_texts", lambda *a, **k: (_ for _ in ()).throw(embeddings.EmbeddingUnavailable("test"))
    )
    return stub


def _as(api, user):
    api.cookies.clear()
    api.headers.pop("X-CSRF-Token", None)
    login(api, user.email)


def _editor(api, factory, role=RoleCode.EDITOR, **kw):
    user = factory.user(role, **kw)
    _as(api, user)
    return user


def test_analyze_gives_grounded_proposal_and_changes_nothing(api, factory, model):
    _editor(api, factory)
    tag = factory.add(Tag(name={"ru": "ДЕМО тема войны"}, workflow_status=WorkflowStatus.PUBLISHED))
    doc = public_document(
        factory, summary={"ru": "Приказ директора Иванов Пётр о передаче дел. Усть-Каменогорск, 14 марта 1972 года."}
    )
    model.reply = json.dumps({
        "dates": ["14 марта 1972 года", "1 января 2001"],
        "persons": ["Иванов Пётр", "Выдуманный Человек"],
        "organizations": [], "places": ["Усть-Каменогорск"], "events": [], "topics": ["передача дел"],
        "tag_numbers": [1, 7],
        "summary": "Приказ о передаче дел. Подробнее: https://evil.example/x",
    })
    response = api.post(f"{BASE}/documents/{doc.id}/analyze", json={"lang": "ru"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dates"] == ["14 марта 1972 года"]
    assert body["persons"] == ["Иванов Пётр"]
    assert body["places"] == ["Усть-Каменогорск"]
    assert [t["id"] for t in body["tags"]] == [str(tag.id)]
    assert "evil.example" not in body["summary"] and "http" not in body["summary"]
    factory.session.refresh(doc)
    assert doc.version == 1 and "Приказ о передаче" not in json.dumps(doc.summary, ensure_ascii=False)
    factory.session.execute(Tag.__table__.delete().where(Tag.id == tag.id))
    factory.session.commit()


def test_analyze_needs_ai_use_and_reports_unavailable(api, factory, model, monkeypatch):
    doc = public_document(factory)
    _editor(api, factory, RoleCode.ANALYST)
    assert api.post(f"{BASE}/documents/{doc.id}/analyze", json={}).status_code == 403
    _editor(api, factory)
    monkeypatch.setattr(ollama_client, "availability", lambda s: ollama_client.Availability(False, "ollama_unavailable"))
    response = api.post(f"{BASE}/documents/{doc.id}/analyze", json={})
    assert response.status_code == 503
    assert response.json() == {"detail": "ai_unavailable", "reason": "ollama_unavailable"}


def test_apply_is_explicit_versioned_and_field_by_field(api, factory, model):
    _editor(api, factory)
    tag = factory.add(Tag(name={"ru": "ДЕМО тег"}, workflow_status=WorkflowStatus.PUBLISHED))
    doc = public_document(factory, authors={"ru": "Прежний автор"})
    url = f"{BASE}/documents/{doc.id}/apply"
    ok = api.post(url, json={"version": 1, "summary": "Новое описание https://x.example", "tag_ids": [str(tag.id)]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["version"] == 2 and ok.json()["applied"] == ["summary", "tags"]
    factory.session.refresh(doc)
    assert "x.example" not in doc.summary["ru"] and doc.summary["ru"].startswith("Новое описание")
    assert doc.authors == {"ru": "Прежний автор"}  # not accepted → untouched
    assert [t.id for t in doc.tags] == [tag.id]
    assert api.post(url, json={"version": 1, "summary": "Устаревшая версия"}).status_code == 409
    assert api.post(url, json={"version": 2, "tag_ids": [str(uuid.uuid4())]}).status_code == 422
    assert api.post(url, json={"version": 2}).status_code == 422
    doc.tags = []
    factory.session.commit()
    factory.session.execute(Tag.__table__.delete().where(Tag.id == tag.id))
    factory.session.commit()


def test_apply_checks_branch_rights(api, factory, model):
    mine, other = factory.branch(), factory.branch()
    _, _, case = factory.catalog(other)
    doc = public_document(factory, case)
    _editor(api, factory, RoleCode.ARCHIVIST, branch_id=mine.id)
    assert api.post(f"{BASE}/documents/{doc.id}/apply", json={"version": 1, "summary": "x"}).status_code == 403


def test_duplicates_by_hash_respect_visibility(api, factory, model):
    mine, other = factory.branch(), factory.branch()
    _, _, case_mine = factory.catalog(mine)
    _, _, case_other = factory.catalog(other)
    _, _, case_mine2 = factory.catalog(mine)
    doc = public_document(factory, case_mine)
    twin = public_document(factory, case_mine2, title={"ru": "ДЕМО двойник"})
    hidden = public_document(factory, case_other, title={"ru": "ДЕМО чужой"})
    digest = uuid.uuid4().hex * 2
    for d in (doc, twin, hidden):
        add_file(factory, d, sha256=digest)
    _editor(api, factory, RoleCode.ARCHIVIST, branch_id=mine.id)
    model.reply = json.dumps({k: [] for k in ("dates", "persons", "organizations", "places", "events", "topics", "tag_numbers")} | {"summary": ""})
    body = api.post(f"{BASE}/documents/{doc.id}/analyze", json={}).json()
    assert [(d["id"], d["reason"]) for d in body["duplicates"]] == [(str(twin.id), "same_file")]


def _png_file(factory, doc, tmp_path: Path, **values) -> DigitalFile:
    path = tmp_path / "masters" / "scan.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG fake")
    return add_file(factory, doc, master_path="masters/scan.png", mime="image/png", **values)


@pytest.fixture
def storage(tmp_path):
    settings = Settings(**{**get_settings().model_dump(), "storage_dir": tmp_path})
    app.dependency_overrides[get_settings] = lambda: settings
    yield tmp_path
    app.dependency_overrides.pop(get_settings, None)


def test_ocr_without_engine_is_unavailable_not_an_error(api, factory, model, storage, monkeypatch):
    monkeypatch.setattr(tools_ocr.shutil, "which", lambda name: None)
    doc = public_document(factory)
    file = _png_file(factory, doc, storage, access=FileAccess.NEEDS_REVIEW)
    _editor(api, factory)
    assert api.get(f"{BASE}/status").json()["ocr_engine"] is None
    response = api.post(f"{BASE}/files/{file.id}/ocr")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable" and response.json()["text"] == ""
    factory.session.refresh(file)
    assert file.ocr_text is None  # a proposal never writes text


def test_ocr_proposal_is_stored_only_on_apply(api, factory, model, storage, monkeypatch):
    monkeypatch.setattr(tools_ocr, "engine_name", lambda settings: "tesseract")
    monkeypatch.setattr(tools_ocr, "_tesseract", lambda path: tools_ocr.OcrOutcome("done", "tesseract", "Распознанный текст"))
    doc = public_document(factory)
    file = _png_file(factory, doc, storage)
    _editor(api, factory)
    proposal = api.post(f"{BASE}/files/{file.id}/ocr").json()
    assert proposal["status"] == "done" and proposal["text"] == "Распознанный текст"
    factory.session.refresh(file)
    assert file.ocr_text is None
    applied = api.post(f"{BASE}/files/{file.id}/ocr/apply", json={"text": "Исправленный текст"})
    assert applied.status_code == 200 and applied.json()["ocr_status"] == "done"
    factory.session.refresh(file)
    assert file.ocr_text == "Исправленный текст" and file.ocr_status == OcrStatus.DONE
    _as(api, factory.user(RoleCode.ANALYST))
    assert api.post(f"{BASE}/files/{file.id}/ocr/apply", json={"text": "x"}).status_code == 403


def test_pdf_is_not_recognised(api, factory, storage, monkeypatch):
    monkeypatch.setattr(tools_ocr, "engine_name", lambda settings: "tesseract")
    doc = public_document(factory)
    (storage / "masters").mkdir(exist_ok=True)
    (storage / "masters" / "a.pdf").write_bytes(b"%PDF")
    file = add_file(factory, doc, master_path="masters/a.pdf", mime="application/pdf")
    _editor(api, factory)
    body = api.post(f"{BASE}/files/{file.id}/ocr").json()
    assert body["status"] == "unavailable" and body["reason"] == "unsupported_type"


def test_annotation_from_public_text_only_and_approval_flow(api, factory, model):
    doc = public_document(factory, summary={"ru": "Описание дела о строительстве моста."})
    open_file = add_file(factory, doc, ocr_text="Открытый текст про мост через Иртыш.")
    closed_file = add_file(factory, doc, ocr_text=SECRET, access=FileAccess.CLOSED)
    _editor(api, factory)
    model.reply = "Документ о строительстве моста. Источник: http://evil.example и [S9]."
    draft = api.post(f"{BASE}/documents/{doc.id}/annotations/generate", json={"lang": "ru"})
    assert draft.status_code == 200, draft.text
    assert draft.json()["status"] == "draft" and draft.json()["uses_file_text"] is True
    assert "evil.example" not in draft.json()["text"] and "[S9]" not in draft.json()["text"]
    assert "мост через Иртыш" in model.prompts[-1] and SECRET not in model.prompts[-1]
    # A draft is invisible to visitors.
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=ru").json()["annotation"] is None
    edited = api.put(f"{BASE}/documents/{doc.id}/annotations/ru", json={"text": "Править вручную. https://a.example"})
    assert edited.status_code == 200 and "a.example" not in edited.json()["text"]
    approved = api.post(f"{BASE}/documents/{doc.id}/annotations/ru/approve")
    assert approved.json()["status"] == "approved"
    card = api.get(f"/api/catalog/documents/{doc.id}?lang=ru").json()["annotation"]
    assert card["text"].startswith("Править вручную") and card["label"]
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=kk").json()["annotation"] is None
    # The text came from file OCR: once no file is open any more, it disappears from the card.
    open_file.access = FileAccess.CLOSED
    factory.session.commit()
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=ru").json()["annotation"] is None
    open_file.access = FileAccess.OPEN
    factory.session.commit()
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=ru").json()["annotation"] is not None
    assert api.delete(f"{BASE}/documents/{doc.id}/annotations/ru").status_code == 204
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=ru").json()["annotation"] is None
    assert closed_file.access == FileAccess.CLOSED
    factory.session.query(DocumentAnnotation).filter_by(document_id=doc.id).delete()
    factory.session.commit()


def test_annotation_refused_for_non_public_document_without_calling_the_model(api, factory, model):
    draft_doc = public_document(factory, workflow_status=WorkflowStatus.DRAFT, summary={"ru": "Черновик"})
    _editor(api, factory)
    response = api.post(f"{BASE}/documents/{draft_doc.id}/annotations/generate", json={"lang": "ru"})
    assert response.status_code == 409 and response.json()["detail"] == "not_public"
    assert model.prompts == []
    empty = public_document(factory)
    assert api.post(f"{BASE}/documents/{empty.id}/annotations/generate", json={}).json()["detail"] == "no_source_text"


def test_annotation_not_shown_after_unpublish(api, factory, model):
    doc = public_document(factory, summary={"ru": "Описание."})
    _editor(api, factory)
    model.reply = "Краткое содержание."
    api.post(f"{BASE}/documents/{doc.id}/annotations/generate", json={"lang": "ru"})
    api.post(f"{BASE}/documents/{doc.id}/annotations/ru/approve")
    doc.workflow_status = WorkflowStatus.ARCHIVED
    factory.session.commit()
    assert api.get(f"/api/catalog/documents/{doc.id}?lang=ru").status_code == 404
    assert api.post(f"{BASE}/documents/{doc.id}/annotations/ru/approve").status_code == 409
    factory.session.query(DocumentAnnotation).filter_by(document_id=doc.id).delete()
    factory.session.commit()


def test_collection_draft_reports_unavailable_embeddings(api, factory, model, monkeypatch):
    monkeypatch.setattr(embeddings, "embed_query", lambda *a, **k: None)
    _editor(api, factory)
    response = api.post(f"{BASE}/collections/draft", json={"topic": "строительство мостов"})
    assert response.status_code == 503 and response.json()["reason"] == "embeddings_unavailable"


def test_anonymous_has_no_access(api):
    api.cookies.clear()
    assert api.get(f"{BASE}/status").status_code == 401
