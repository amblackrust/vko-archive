"""T5.2/T5.3/T5.16: public pages, FAQ and contacts are published-only and language-fallback aware.
Objects are committed to the test DB (the API uses its own sessions) and removed afterwards.
The test DB is rebuilt from scratch per run, so there is no seed data here."""

import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models import FAQ, Page, SiteSetting
from app.models.enums import WorkflowStatus


@pytest.fixture
def cms(engine: Engine) -> Iterator[Callable[[Any], None]]:
    session = Session(engine, expire_on_commit=False)
    created: list[Any] = []

    def add(obj: Any) -> None:
        session.add(obj)
        session.commit()
        created.append(obj)

    yield add
    session.rollback()
    for obj in reversed(created):
        session.delete(obj)
    session.commit()
    session.close()


def _key() -> str:
    return f"test-{uuid.uuid4().hex[:12]}"


def test_published_page_falls_back_to_ru_and_reports_status(client: TestClient, cms: Callable[[Any], None]):
    key = _key()
    cms(Page(
        key=key, title={"ru": "ДЕМО страница"}, body={"ru": "<p>Текст</p>"},
        workflow_status=WorkflowStatus.PUBLISHED, translation_status={"ru": "verified"},
    ))
    response = client.get(f"/api/pages/{key}", params={"lang": "en"})
    assert response.status_code == 200
    assert response.json() == {
        "key": key, "title": "ДЕМО страница", "body": "<p>Текст</p>", "lang": "ru",
        "translation_status": "verified",
    }


def test_draft_and_unknown_pages_are_404_and_bad_key_is_422(client: TestClient, cms: Callable[[Any], None]):
    key = _key()
    cms(Page(key=key, title={"ru": "Черновик"}, body={"ru": "x"}, workflow_status=WorkflowStatus.DRAFT))
    assert client.get(f"/api/pages/{key}").status_code == 404
    assert client.get(f"/api/pages/{_key()}").status_code == 404
    assert client.get("/api/pages/Bad_Key").status_code == 422


def test_faq_lists_only_published_grouped_by_topic(client: TestClient, cms: Callable[[Any], None]):
    topic = f"topic{uuid.uuid4().hex[:8]}"
    cms(FAQ(
        category=topic, question={"ru": "ДЕМО вопрос 1", "en": "Q1"}, answer={"ru": "Ответ 1"},
        position=1, workflow_status=WorkflowStatus.PUBLISHED, translation_status={"ru": "verified", "en": "machine"},
    ))
    cms(FAQ(
        category=topic, question={"ru": "Скрытый"}, answer={"ru": "Скрытый"},
        position=2, workflow_status=WorkflowStatus.DRAFT,
    ))
    body = client.get("/api/faqs", params={"lang": "en"}).json()
    group = next(g for g in body["groups"] if g["category"] == topic)
    assert [item["question"] for item in group["items"]] == ["Q1"]
    # The answer exists only in ru: the fallback text is reported with its own language and status.
    assert group["items"][0]["answer"] == "Ответ 1"
    assert (group["items"][0]["lang"], group["items"][0]["translation_status"]) == ("ru", "verified")
    assert all(item["question"] != "Скрытый" for g in body["groups"] for item in g["items"])


def test_contacts_come_from_site_settings(client: TestClient, cms: Callable[[Any], None]):
    value = {
        "address": "ДЕМО адрес", "director": "ДЕМО директор",
        "phones": [{"label": "Приёмная", "value": "8 (000) 000-00-00"}],
        "email": "demo@example.test", "hours": "Пн–Пт 8.00–17.00", "reading_room_hours": "Пн–Пт 9.00–16.00",
    }
    cms(SiteSetting(key="contacts", value=value))
    assert client.get("/api/contacts").json() == value
