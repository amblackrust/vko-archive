"""System health: database, Ollama chat model, embeddings.

Never raises: an unavailable component is reported in its status. Error details are
limited to exception class names so connection strings never leak into responses, and
model names are not exposed. The endpoint is public, so Ollama probes use a short
timeout and their result is cached in memory (one probe per TTL, see `_probe_ollama_cached`).
"""

import threading
import time

import httpx
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.base import EMBEDDING_DIM
from app.repositories import system as system_repo
from app.schemas.health import ComponentStatus, HealthResponse

REQUIRED_EXTENSIONS = {"vector", "pg_trgm"}

# (ollama_url, chat model, embed model) -> (monotonic time of probe, (ollama, embeddings))
_ollama_cache: dict[tuple[str, str, str], tuple[float, tuple[ComponentStatus, ComponentStatus]]] = {}
_ollama_cache_lock = threading.Lock()


def _has_model(available: set[str], name: str) -> bool:
    return name in available or (":" not in name and f"{name}:latest" in available)


def check_db(session: Session) -> ComponentStatus:
    try:
        system_repo.ping(session)
        missing = REQUIRED_EXTENSIONS - system_repo.installed_extensions(session)
    except SQLAlchemyError as exc:
        return ComponentStatus(status="unavailable", detail=type(exc).__name__)
    if missing:
        return ComponentStatus(
            status="degraded", detail=f"missing extensions: {', '.join(sorted(missing))} (run alembic upgrade head)"
        )
    return ComponentStatus(status="ok")


def _list_ollama_models(client: httpx.Client) -> set[str]:
    response = client.get("/api/tags")
    response.raise_for_status()
    return {model["name"] for model in response.json().get("models", [])}


def check_ollama(client: httpx.Client, settings: Settings) -> tuple[ComponentStatus, set[str] | None]:
    try:
        models = _list_ollama_models(client)
    except (httpx.HTTPError, ValueError) as exc:
        return ComponentStatus(status="unavailable", detail=type(exc).__name__), None
    if not _has_model(models, settings.ollama_model):
        return ComponentStatus(status="degraded", detail="chat model not pulled"), models
    return ComponentStatus(status="ok"), models


def check_embeddings(client: httpx.Client, settings: Settings, models: set[str] | None) -> ComponentStatus:
    if models is None:
        return ComponentStatus(status="unavailable", detail="ollama unavailable")
    if not _has_model(models, settings.ollama_embed_model):
        return ComponentStatus(status="unavailable", detail="embedding model not pulled")
    try:
        response = client.post(
            "/api/embed",
            json={"model": settings.ollama_embed_model, "input": "health", "keep_alive": "30m"},
        )
        response.raise_for_status()
        dim = len(response.json()["embeddings"][0])
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        return ComponentStatus(status="unavailable", detail=type(exc).__name__)
    if dim != EMBEDDING_DIM:
        return ComponentStatus(status="degraded", detail=f"dimension {dim} != expected {EMBEDDING_DIM}")
    return ComponentStatus(status="ok", detail=f"dim={dim}")


def _make_client(settings: Settings) -> httpx.Client:
    return httpx.Client(base_url=settings.ollama_url, timeout=settings.health_probe_timeout_seconds)


def _probe_ollama(settings: Settings) -> tuple[ComponentStatus, ComponentStatus]:
    with _make_client(settings) as client:
        ollama, models = check_ollama(client, settings)
        embeddings = check_embeddings(client, settings, models)
    return ollama, embeddings


def _probe_ollama_cached(settings: Settings) -> tuple[ComponentStatus, ComponentStatus]:
    # The lock is held during the probe on purpose: concurrent requests wait for one
    # probe instead of each hitting Ollama (no stampede on an expired cache).
    key = (settings.ollama_url, settings.ollama_model, settings.ollama_embed_model)
    with _ollama_cache_lock:
        cached = _ollama_cache.get(key)
        now = time.monotonic()
        if cached is not None and now - cached[0] < settings.health_cache_ttl_seconds:
            return cached[1]
        result = _probe_ollama(settings)
        _ollama_cache[key] = (time.monotonic(), result)
        return result


def clear_cache() -> None:
    with _ollama_cache_lock:
        _ollama_cache.clear()


def get_health(session: Session, settings: Settings) -> HealthResponse:
    db = check_db(session)
    ollama, embeddings = _probe_ollama_cached(settings)
    overall = "ok" if all(c.status == "ok" for c in (db, ollama, embeddings)) else "degraded"
    return HealthResponse(status=overall, db=db, ollama=ollama, embeddings=embeddings)
