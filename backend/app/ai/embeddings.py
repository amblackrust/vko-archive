"""Minimal Ollama embeddings client (bge-m3) for search indexing and query vectors.

Raises EmbeddingUnavailable on any failure (Ollama down, model missing, wrong dimension)
so callers can degrade: search falls back to FTS + trigram, the indexer leaves
`embedding` NULL to be filled later by `python -m app.services.indexing`.
"""

import threading
import time

import httpx

from app.config import Settings
from app.models.base import EMBEDDING_DIM

# After a failure, query-time embedding is skipped for this long so that every search
# request does not wait for a dead Ollama (the indexer is not affected).
FAILURE_COOLDOWN_SECONDS = 30.0

_last_failure = 0.0
_lock = threading.Lock()


class EmbeddingUnavailable(Exception):
    pass


def embed_texts(texts: list[str], settings: Settings, *, timeout: float | None = None) -> list[list[float]]:
    """One vector per text, in order. Never returns vectors of an unexpected size."""
    if not texts:
        return []
    try:
        with httpx.Client(
            base_url=settings.ollama_url, timeout=timeout or settings.ollama_embed_timeout_seconds
        ) as client:
            response = client.post(
                "/api/embed",
                json={"model": settings.ollama_embed_model, "input": texts, "keep_alive": "30m"},
            )
            response.raise_for_status()
            vectors = response.json()["embeddings"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise EmbeddingUnavailable(type(exc).__name__) from exc
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise EmbeddingUnavailable("unexpected response")
    if any(len(vector) != EMBEDDING_DIM for vector in vectors):
        raise EmbeddingUnavailable(f"dimension != {EMBEDDING_DIM}")
    return vectors


def embed_query(text: str, settings: Settings, *, timeout: float) -> list[float] | None:
    """Vector for a search query, or None if embeddings are unavailable (recently failed)."""
    global _last_failure
    with _lock:
        if time.monotonic() - _last_failure < FAILURE_COOLDOWN_SECONDS:
            return None
    try:
        return embed_texts([text], settings, timeout=timeout)[0]
    except EmbeddingUnavailable:
        with _lock:
            _last_failure = time.monotonic()
        return None


def reset_failure_state() -> None:
    global _last_failure
    with _lock:
        _last_failure = 0.0
