from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.main import app

# Nothing listens on the discard port, so Ollama is "down" without mocks.
UNREACHABLE_OLLAMA = "http://127.0.0.1:9"


def _settings_without_ollama():
    return get_settings().model_copy(update={"ollama_url": UNREACHABLE_OLLAMA, "ollama_timeout_seconds": 1})


def test_health_reports_db_ok_and_ollama_unavailable(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = _settings_without_ollama

    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["db"]["status"] == "ok"
    assert body["ollama"]["status"] == "unavailable"
    assert body["embeddings"]["status"] == "unavailable"


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
