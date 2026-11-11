"""T6.11: translation status, machine draft through Ollama (mocked), verification."""

import json
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from app.ai import ollama_client
from app.main import app
from app.models import AuditLog, Document, Page, WorkflowHistory
from app.models.enums import RoleCode, WorkflowStatus
from app.services import translations
from tests.admin.conftest import login


@pytest.fixture(autouse=True)
def _cleanup_history(engine: Engine, factory, api) -> Iterator[None]:
    yield
    ids = [obj.id for obj in factory._created if isinstance(obj, Document)]
    if ids:
        with Session(engine) as session:
            session.execute(delete(WorkflowHistory).where(WorkflowHistory.object_id.in_(ids)))
            session.commit()


def client_for(factory, role: RoleCode, **kwargs) -> TestClient:
    user = factory.user(role, **kwargs)
    client = TestClient(app, base_url="https://testserver")
    login(client, user.email)
    return client


def make_doc(factory, **values) -> Document:
    values.setdefault("title", {"ru": "ДЕМО Приказ о создании архива"})
    values.setdefault("translation_status", {"ru": "verified", "kk": "missing", "en": "missing"})
    return factory.add(Document(is_demo=True, archive_code=f"TRTEST-{uuid.uuid4().hex[:8]}", **values))


@pytest.fixture
def fake_chat(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    calls: list[dict] = []

    def _chat(messages, settings, *, fmt=None, timeout=None):
        texts = json.loads(messages[-1]["content"])
        calls.append({"messages": messages, "fmt": fmt, "num_predict": settings.ollama_num_predict})
        return json.dumps({key: f"EN: {value}" for key, value in texts.items()})

    monkeypatch.setattr(ollama_client, "chat", _chat)
    return calls


def machine(client: TestClient, doc: Document, version: int = 1, **extra):
    return client.post(
        f"/api/admin/translations/document/{doc.id}/machine",
        json={"source_lang": "ru", "target_lang": "en", "version": version, **extra},
    )


def test_translatable_fields():
    assert translations.translatable_fields(Document) == ["title", "authors", "historical_note", "summary", "access_conditions"]
    assert "body" in translations.translatable_fields(Page)


def test_machine_translation_is_marked_and_stays_draft(factory, engine, fake_chat):
    doc = make_doc(factory, summary={"ru": "Краткое содержание"})
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    response = machine(client, doc)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["fields"]["title"]["en"] == "EN: ДЕМО Приказ о создании архива"
    assert body["fields"]["summary"]["en"] == "EN: Краткое содержание"
    assert body["translation_status"]["en"] == "machine" and body["version"] == 2
    assert body["workflow_status"] == "draft"
    assert fake_chat[0]["fmt"]["required"] == ["title", "summary"]
    with Session(engine) as session:
        entry = session.scalars(
            select(AuditLog).where(AuditLog.action_type == "translation.machine", AuditLog.object_id == str(doc.id))
        ).one()
        assert "Краткое" not in json.dumps(entry.details, ensure_ascii=False)  # no texts in the journal
        assert session.scalar(select(WorkflowHistory.version).where(WorkflowHistory.object_id == doc.id)) == 2

    verified = client.post(f"/api/admin/translations/document/{doc.id}/verify", json={"lang": "en", "version": 2})
    assert verified.status_code == 200 and verified.json()["translation_status"]["en"] == "verified"
    # A verified language is not overwritten by the machine unless asked explicitly.
    assert machine(client, doc, version=3).json()["detail"] == "target_verified"
    assert machine(client, doc, version=3, overwrite=True).status_code == 200


def test_published_object_is_not_machine_translated(factory, fake_chat):
    doc = make_doc(factory, workflow_status=WorkflowStatus.PUBLISHED)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    response = machine(client, doc)
    assert response.status_code == 409 and response.json()["detail"] == "translation_requires_draft"
    assert fake_chat == []


def test_stale_version_and_bad_language(factory, fake_chat):
    doc = make_doc(factory)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    assert machine(client, doc, version=7).status_code == 409
    same = client.post(f"/api/admin/translations/document/{doc.id}/machine",
                       json={"source_lang": "ru", "target_lang": "ru", "version": 1})
    assert same.status_code == 422
    empty = make_doc(factory, title={"kk": "Тек қазақша"})
    assert machine(client, empty).json()["detail"] == "nothing_to_translate"


@pytest.mark.parametrize("failure", ["ollama_unavailable", "busy", "not_json"])
def test_ollama_failures_give_503_and_leave_object_unchanged(factory, engine, monkeypatch, failure):
    def _chat(*args, **kwargs):
        if failure == "not_json":
            return "Sure! Here is the translation"
        raise ollama_client.OllamaUnavailable(failure)

    monkeypatch.setattr(ollama_client, "chat", _chat)
    doc = make_doc(factory)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    response = machine(client, doc)
    assert response.status_code == 503
    assert response.json() == {"detail": "ai_unavailable", "reason": "bad_response" if failure == "not_json" else failure}
    with Session(engine) as session:
        fresh = session.get(Document, doc.id)
        assert fresh.version == 1 and "en" not in fresh.title


def test_permissions_and_branch(factory, fake_chat):
    own, other = factory.branch(), factory.branch()
    doc = make_doc(factory, branch_id=other.id)
    moderator = client_for(factory, RoleCode.MODERATOR)  # no catalog.edit
    assert machine(moderator, doc).status_code == 403
    archivist = client_for(factory, RoleCode.ARCHIVIST, branch_id=own.id)
    assert machine(archivist, doc).status_code == 403
    assert archivist.get(f"/api/admin/translations/document/{doc.id}").status_code == 403
    analyst = client_for(factory, RoleCode.ANALYST)
    assert analyst.get("/api/admin/translations", params={"object_type": "document"}).status_code == 403
    assert fake_chat == []
    own_doc = make_doc(factory, branch_id=own.id)
    assert machine(archivist, own_doc).status_code == 200


def test_list_filters_by_language_status_and_branch(factory):
    own, other = factory.branch(), factory.branch()
    missing = make_doc(factory, branch_id=own.id, title={"ru": "ДЕМО TRLIST один"})
    make_doc(factory, branch_id=other.id, title={"ru": "ДЕМО TRLIST два"})
    make_doc(factory, branch_id=own.id, title={"ru": "ДЕМО TRLIST три"},
             translation_status={"ru": "verified", "en": "machine"})
    archivist = client_for(factory, RoleCode.ARCHIVIST, branch_id=own.id)
    response = archivist.get("/api/admin/translations",
                             params={"object_type": "document", "lang": "en", "status": "missing", "q": "TRLIST"})
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [item["id"] for item in items] == [str(missing.id)]
    assert items[0]["translation_status"] == {"kk": "missing", "ru": "verified", "en": "missing"}
    assert archivist.get("/api/admin/translations", params={"object_type": "nope"}).status_code == 422


def test_html_translation_is_sanitized(monkeypatch):
    monkeypatch.setattr(ollama_client, "chat", lambda *a, **k: json.dumps({"body": "<p>Hi</p><script>alert(1)</script>"}))
    from app.config import get_settings

    result = translations._translate({"body": "<p>Привет</p>"}, "ru", "en", get_settings())
    assert result == {"body": "<p>Hi</p>"}


def test_text_translation_is_stateless_and_needs_settings_edit(factory, fake_chat):
    body = {"text": "Вопрос опроса", "source_lang": "ru", "target_lang": "en"}
    site_admin = client_for(factory, RoleCode.SITE_ADMIN)
    response = site_admin.post("/api/admin/translations/text", json=body)
    assert response.status_code == 200, response.text
    assert response.json() == {"text": "EN: Вопрос опроса"}
    assert fake_chat[0]["fmt"]["required"] == ["text"]
    assert site_admin.post("/api/admin/translations/text", json={**body, "target_lang": "ru"}).status_code == 422
    assert site_admin.post("/api/admin/translations/text", json={**body, "text": ""}).status_code == 422
    editor = client_for(factory, RoleCode.EDITOR)  # no settings.edit
    assert editor.post("/api/admin/translations/text", json=body).status_code == 403
    assert len(fake_chat) == 1


def test_text_translation_failure_gives_503(factory, monkeypatch):
    def _chat(*args, **kwargs):
        raise ollama_client.OllamaUnavailable("busy")

    monkeypatch.setattr(ollama_client, "chat", _chat)
    client = client_for(factory, RoleCode.SITE_ADMIN)
    response = client.post("/api/admin/translations/text", json={"text": "Привет", "source_lang": "ru", "target_lang": "kk"})
    assert response.status_code == 503 and response.json() == {"detail": "ai_unavailable", "reason": "busy"}
