"""Ollama client for the public AI features (T4.1): chat (plain / JSON schema / stream),
embeddings, availability.

- Every /api/chat call sends `"think": false` (Qwen3.5 is a thinking model) and
  `keep_alive: "30m"`; `<think>…</think>` blocks are still removed from the output.
- The chat model is OLLAMA_MODEL if it is pulled, else OLLAMA_FALLBACK_MODEL; the model
  list is cached for a minute. No model / Ollama down → `OllamaUnavailable`, never a
  generic exception, so callers degrade to plain search (`ai_available = false`).
- One retry on connection errors, timeouts and 5xx — for a stream only before the first
  token (a half-sent answer is not repeated).
- After a failure Ollama is not tried again for `FAILURE_COOLDOWN_SECONDS`, so requests
  do not each wait for a dead server.

Embeddings stay in `app.ai.embeddings` (used by the search indexer); `embed` re-exports them.
"""

import json
import logging
import re
import threading
import time
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.ai.embeddings import embed_texts
from app.config import Settings

logger = logging.getLogger(__name__)

MODELS_CACHE_SECONDS = 60.0
FAILURE_COOLDOWN_SECONDS = 30.0
KEEP_ALIVE = "30m"
TEMPERATURE = 0.1

_THINK_RE = re.compile(r"<think>.*?(</think>|$)", re.DOTALL)
_OPEN, _CLOSE = "<think>", "</think>"

_state_lock = threading.Lock()
_models_cache: dict[str, tuple[float, set[str]]] = {}  # ollama_url -> (time, model names)
_last_failure = 0.0


class OllamaUnavailable(Exception):
    """`reason`: ollama_unavailable | model_missing | bad_response."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Availability:
    available: bool
    reason: str | None = None  # see OllamaUnavailable


def embed(texts: list[str], settings: Settings, *, timeout: float | None = None) -> list[list[float]]:
    return embed_texts(texts, settings, timeout=timeout)


def strip_think(text: str) -> str:
    return _THINK_RE.sub("", text).strip()


def reset_state() -> None:
    """Forget cached model lists and failures (tests, admin "retry")."""
    global _last_failure
    with _state_lock:
        _models_cache.clear()
        _last_failure = 0.0


def _mark_failure() -> None:
    global _last_failure
    with _state_lock:
        _last_failure = time.monotonic()
        _models_cache.clear()


def _in_cooldown() -> bool:
    with _state_lock:
        return time.monotonic() - _last_failure < FAILURE_COOLDOWN_SECONDS


def _has(models: set[str], name: str) -> bool:
    return name in models or (":" not in name and f"{name}:latest" in models)


def _client(settings: Settings, timeout: float | httpx.Timeout) -> httpx.Client:
    return httpx.Client(base_url=settings.ollama_url, timeout=timeout)


def _models(settings: Settings) -> set[str]:
    with _state_lock:
        cached = _models_cache.get(settings.ollama_url)
        if cached and time.monotonic() - cached[0] < MODELS_CACHE_SECONDS:
            return cached[1]
    try:
        with _client(settings, settings.ollama_timeout_seconds) as client:
            response = client.get("/api/tags")
            response.raise_for_status()
            models = {m["name"] for m in response.json().get("models", [])}
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.warning("Ollama model list failed: %s", type(exc).__name__)
        _mark_failure()
        raise OllamaUnavailable("ollama_unavailable") from exc
    with _state_lock:
        _models_cache[settings.ollama_url] = (time.monotonic(), models)
    return models


def chat_model(settings: Settings) -> str:
    """The model to use, or OllamaUnavailable."""
    if _in_cooldown():
        raise OllamaUnavailable("ollama_unavailable")
    models = _models(settings)
    for name in (settings.ollama_model, settings.ollama_fallback_model):
        if name and _has(models, name):
            return name
    raise OllamaUnavailable("model_missing")


def availability(settings: Settings) -> Availability:
    try:
        chat_model(settings)
    except OllamaUnavailable as exc:
        return Availability(False, exc.reason)
    return Availability(True)


def _payload(settings: Settings, model: str, messages: list[dict[str, str]], stream: bool, fmt: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "think": False,
        "keep_alive": KEEP_ALIVE,
        "options": {"temperature": TEMPERATURE, "num_ctx": settings.ollama_num_ctx},
    }
    if fmt is not None:
        payload["format"] = fmt
    return payload


def _timeout(settings: Settings, read: float) -> httpx.Timeout:
    return httpx.Timeout(read, connect=settings.ollama_timeout_seconds)


def _retryable(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError)


def chat(
    messages: list[dict[str, str]],
    settings: Settings,
    *,
    fmt: Any = None,
    timeout: float | None = None,
) -> str:
    """Whole answer (think blocks removed). `fmt`: "json" or a JSON schema."""
    model = chat_model(settings)
    payload = _payload(settings, model, messages, False, fmt)
    for attempt in (1, 2):
        try:
            with _client(settings, _timeout(settings, timeout or settings.ollama_chat_timeout_seconds)) as client:
                response = client.post("/api/chat", json=payload)
                response.raise_for_status()
                content = response.json()["message"]["content"]
            if not isinstance(content, str):
                raise OllamaUnavailable("bad_response")
            return strip_think(content)
        except httpx.HTTPError as exc:
            if attempt == 1 and _retryable(exc):
                logger.info("Ollama chat failed (%s), retrying once", type(exc).__name__)
                continue
            logger.warning("Ollama chat failed: %s", type(exc).__name__)
            _mark_failure()
            raise OllamaUnavailable("ollama_unavailable") from exc
        except (ValueError, KeyError, TypeError) as exc:
            raise OllamaUnavailable("bad_response") from exc
    raise AssertionError("unreachable")


class _ThinkFilter:
    """Drops <think>…</think> from a token stream (tags may be split across chunks)."""

    def __init__(self) -> None:
        self._buffer = ""
        self._inside = False

    def feed(self, chunk: str) -> str:
        self._buffer += chunk
        out: list[str] = []
        while self._buffer:
            tag = _CLOSE if self._inside else _OPEN
            index = self._buffer.find(tag)
            if index >= 0:
                if not self._inside:
                    out.append(self._buffer[:index])
                self._buffer = self._buffer[index + len(tag) :]
                self._inside = not self._inside
                continue
            # Keep a possible partial tag at the end for the next chunk.
            keep = next((n for n in range(len(tag) - 1, 0, -1) if self._buffer.endswith(tag[:n])), 0)
            if not self._inside:
                out.append(self._buffer[: len(self._buffer) - keep])
            self._buffer = self._buffer[len(self._buffer) - keep :] if keep else ""
            break
        return "".join(out)

    def flush(self) -> str:
        rest, self._buffer = ("" if self._inside else self._buffer), ""
        return rest


def chat_stream(messages: list[dict[str, str]], settings: Settings, *, timeout: float | None = None) -> Iterator[str]:
    """Text chunks as they arrive. Raises OllamaUnavailable before the first chunk if
    Ollama/model is unavailable; a failure mid-stream also raises OllamaUnavailable."""
    model = chat_model(settings)
    payload = _payload(settings, model, messages, True, None)
    think = _ThinkFilter()
    for attempt in (1, 2):
        started = False
        try:
            with _client(settings, _timeout(settings, timeout or settings.ollama_chat_timeout_seconds)) as client:
                with client.stream("POST", "/api/chat", json=payload) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        if "error" in data:
                            raise OllamaUnavailable("bad_response")
                        text = think.feed((data.get("message") or {}).get("content") or "")
                        if text:
                            started = True
                            yield text
                        if data.get("done"):
                            break
            rest = think.flush()
            if rest:
                yield rest
            return
        except httpx.HTTPError as exc:
            if attempt == 1 and not started and _retryable(exc):
                logger.info("Ollama stream failed (%s), retrying once", type(exc).__name__)
                continue
            logger.warning("Ollama stream failed: %s", type(exc).__name__)
            _mark_failure()
            raise OllamaUnavailable("ollama_unavailable") from exc
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            raise OllamaUnavailable("bad_response") from exc
