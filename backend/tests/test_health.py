from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.main import app
from app.models.base import EMBEDDING_DIM
from app.services import health as health_service

# Nothing listens on the discard port, so Ollama is "down" without mocks.
UNREACHABLE_OLLAMA = "http://127.0.0.1:9"


@pytest.fixture(autouse=True)
def _fresh_health_cache() -> Iterator[None]:
    health_service.clear_cache()
    yield
    health_service.clear_cache()


def _settings_without_ollama() -> Settings:
    return get_settings().model_copy(update={"ollama_url": UNREACHABLE_OLLAMA, "health_probe_timeout_seconds": 1})


def _mock_ollama(monkeypatch: pytest.MonkeyPatch, handler) -> list[str]:
    """Route the health probes to an in-process mock; returns the list of requested paths."""
    calls: list[str] = []

    def _recording_handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return handler(request)

    def _make_client(settings: Settings) -> httpx.Client:
        return httpx.Client(base_url=settings.ollama_url, transport=httpx.MockTransport(_recording_handler))

    monkeypatch.setattr(health_service, "_make_client", _make_client)
    return calls


def _healthy_ollama(request: httpx.Request) -> httpx.Response:
    settings = get_settings()
    if request.url.path == "/api/tags":
        return httpx.Response(200, json={"models": [{"name": settings.ollama_model}, {"name": f"{settings.ollama_embed_model}:latest"}]})
    if request.url.path == "/api/embed":
        return httpx.Response(200, json={"embeddings": [[0.0] * EMBEDDING_DIM]})
    return httpx.Response(404)


def test_health_reports_db_ok_and_ollama_unavailable(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = _settings_without_ollama

    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["db"]["status"] == "ok"
    assert body["ollama"]["status"] == "unavailable"
    assert body["embeddings"]["status"] == "unavailable"


def test_health_ok_with_ollama_available_and_hides_model_names(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_ollama(monkeypatch, _healthy_ollama)

    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ollama"]["status"] == "ok"
    assert body["embeddings"] == {"status": "ok", "detail": f"dim={EMBEDDING_DIM}"}
    settings = get_settings()
    assert settings.ollama_model not in response.text
    assert settings.ollama_embed_model not in response.text


def test_health_reports_embedding_dimension_mismatch(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _wrong_dim(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/embed":
            return httpx.Response(200, json={"embeddings": [[0.0] * 3]})
        return _healthy_ollama(request)

    _mock_ollama(monkeypatch, _wrong_dim)

    body = client.get("/api/health").json()

    assert body["status"] == "degraded"
    assert body["embeddings"]["status"] == "degraded"


def test_health_caches_ollama_probes(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _mock_ollama(monkeypatch, _healthy_ollama)

    for _ in range(3):
        assert client.get("/api/health").json()["status"] == "ok"

    assert calls == ["/api/tags", "/api/embed"]  # probed once, then served from cache


def test_health_returns_503_when_db_is_down(client: TestClient) -> None:
    dead_engine = create_engine("postgresql+psycopg://nobody:nothing@127.0.0.1:9/none")

    def _dead_session() -> Iterator[Session]:
        with Session(bind=dead_engine) as session:
            yield session

    app.dependency_overrides[get_session] = _dead_session
    app.dependency_overrides[get_settings] = _settings_without_ollama

    response = client.get("/api/health")

    assert response.status_code == 503
    body = response.json()
    assert body["db"]["status"] == "unavailable"
    assert "nothing" not in response.text  # credentials never leak into the response
    dead_engine.dispose()
