"""Site analytics (T4.11): access by role, no personal data in the report."""

import pytest

from app.ai import ollama_client
from app.models import SearchLog
from app.models.enums import RoleCode
from app.services.analytics import mask_query
from tests.admin.conftest import login
from tests.search.conftest import factory  # noqa: F401  (fixture)

URL = "/api/admin/analytics"
TAG = "демоаналитика"


@pytest.fixture
def logs(factory):
    session = factory.session
    session.query(SearchLog).filter(SearchLog.query.like(f"%{TAG}%")).delete(synchronize_session=False)
    rows = (
        [SearchLog(query=f"{TAG} мост", lang="ru", source="search", results_count=0, zero_result=True)] * 3
        + [SearchLog(query=f"Иванов Пётр Сергеевич {TAG}", lang="ru", source="search", results_count=0, zero_result=True)] * 3
        + [SearchLog(query=f"{TAG} одиночный запрос", lang="ru", source="search", results_count=0, zero_result=True)]
        + [SearchLog(query=f"{TAG} вопрос ии +7 777 123 45 67", lang="ru", source="ai", results_count=2)] * 2
    )
    for row in rows:
        session.add(SearchLog(query=row.query, lang=row.lang, source=row.source, results_count=row.results_count, zero_result=row.zero_result))
    session.commit()
    yield
    session.query(SearchLog).filter(SearchLog.query.like(f"%{TAG}%")).delete(synchronize_session=False)
    session.commit()


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def test_mask_query():
    assert mask_query("Иванов Пётр Сергеевич") == "[ФИО]"
    assert mask_query("Иванов И.И. приказ") == "[ФИО] приказ"
    assert mask_query("мой номер +7 777 123 45 67") == "мой номер [число]"
    assert mask_query("пишите на a.b@mail.kz") == "пишите на [email]"
    assert mask_query("постановление о фондах") == "постановление о фондах"


def test_report_for_analyst_masks_and_hides_rare_queries(api, factory, logs):
    _as(api, factory.user(RoleCode.ANALYST))
    response = api.get(URL, params={"days": 7})
    assert response.status_code == 200, response.text
    body = response.json()
    text = response.text
    assert "Иванов" not in text and "иванов" not in text and "777" not in text
    assert any(q["query"] == f"{TAG} мост" and q["count"] == 3 for q in body["zero_queries"])
    assert not any("одиночный" in q["query"] for q in body["top_queries"] + body["zero_queries"])
    assert body["rare_queries"] >= 1 and body["views_available"] is False
    assert any(q["query"] == f"{TAG} вопрос ии [число]" for q in body["ai_questions"])
    assert "user" not in text and "ip" not in {k for k in body}


def test_report_requires_analytics_permission(api, factory):
    _as(api, factory.user(RoleCode.EDITOR))
    assert api.get(URL).status_code == 403
    api.cookies.clear()
    assert api.get(URL).status_code == 401
    _as(api, factory.user(RoleCode.SITE_ADMIN))
    assert api.get(URL).status_code == 200
    assert api.get(URL, params={"days": 0}).status_code == 422


def test_ai_summary_is_labelled_sanitised_and_degrades(api, factory, logs, monkeypatch):
    _as(api, factory.user(RoleCode.ANALYST))
    monkeypatch.setattr(ollama_client, "availability", lambda s: ollama_client.Availability(False, "ollama_unavailable"))
    down = api.post(f"{URL}/ai-summary")
    assert down.status_code == 200 and down.json()["available"] is False
    monkeypatch.setattr(ollama_client, "availability", lambda s: ollama_client.Availability(True))
    seen = []
    monkeypatch.setattr(ollama_client, "chat", lambda messages, settings, **k: seen.append(messages) or "Ищут мосты. См. http://evil.example")
    up = api.post(f"{URL}/ai-summary").json()
    assert up["available"] is True and up["label"] and "evil.example" not in up["text"]
    assert "Иванов" not in str(seen) and "777" not in str(seen)
