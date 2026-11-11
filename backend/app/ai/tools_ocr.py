"""OCR of a scanned image for staff (T4.9): Tesseract `rus+kaz+eng` if installed, else a
vision model of Ollama (OLLAMA_VISION_MODEL) if it is pulled, else "unavailable".

The result is a proposal: the caller shows it to the employee, nothing is stored here.
Only images are read (no PDF renderer in the stack). Never raises for a missing engine.
"""

import base64
import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.ai import ollama_client
from app.config import Settings

logger = logging.getLogger(__name__)

TESSERACT_LANGS = "rus+kaz+eng"
TESSERACT_TIMEOUT_SECONDS = 180
MAX_VISION_BYTES = 10 * 1024 * 1024
IMAGE_MIMES = frozenset({"image/jpeg", "image/png", "image/tiff", "image/webp"})
VISION_PROMPT = "Распознай весь текст на изображении документа. Выведи только текст, без пояснений и без форматирования."


@dataclass(frozen=True)
class OcrOutcome:
    """status: done | failed | unavailable. `reason` is a machine code for the UI."""

    status: str
    engine: str | None = None
    text: str = ""
    reason: str | None = None


def engine_name(settings: Settings) -> str | None:
    """The engine that would be used now: tesseract | vision | None."""
    if shutil.which("tesseract"):
        return "tesseract"
    if settings.ollama_vision_model:
        try:
            if ollama_client._has(ollama_client._models(settings), settings.ollama_vision_model):
                return "vision"
        except ollama_client.OllamaUnavailable:
            return None
    return None


def _tesseract(path: Path) -> OcrOutcome:
    try:
        done = subprocess.run(  # noqa: S603  (fixed argv, no shell; the path is ours)
            ["tesseract", str(path), "stdout", "-l", TESSERACT_LANGS],
            capture_output=True, timeout=TESSERACT_TIMEOUT_SECONDS, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("tesseract failed: %s", type(exc).__name__)
        return OcrOutcome("failed", "tesseract", reason="engine_error")
    if done.returncode != 0:
        logger.warning("tesseract exit code %s", done.returncode)
        return OcrOutcome("failed", "tesseract", reason="engine_error")
    return OcrOutcome("done", "tesseract", done.stdout.decode("utf-8", "replace").strip())


def _vision(path: Path, settings: Settings) -> OcrOutcome:
    if path.stat().st_size > MAX_VISION_BYTES:
        return OcrOutcome("failed", "vision", reason="file_too_large")
    image = base64.b64encode(path.read_bytes()).decode("ascii")
    payload = {
        "model": settings.ollama_vision_model,
        "messages": [{"role": "user", "content": VISION_PROMPT, "images": [image]}],
        "stream": False, "think": False, "keep_alive": ollama_client.KEEP_ALIVE,
        "options": {"temperature": 0, "num_ctx": settings.ollama_num_ctx, "num_predict": 2000},
    }
    try:
        with ollama_client._generation_slot(settings):
            with ollama_client._client(settings, settings.ollama_chat_timeout_seconds) as client:
                response = client.post("/api/chat", json=payload)
                response.raise_for_status()
                text = response.json()["message"]["content"]
    except ollama_client.OllamaUnavailable as exc:
        return OcrOutcome("failed", "vision", reason=exc.reason)
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.warning("vision OCR failed: %s", type(exc).__name__)
        return OcrOutcome("failed", "vision", reason="engine_error")
    return OcrOutcome("done", "vision", ollama_client.strip_think(text) if isinstance(text, str) else "")


def recognize(path: Path, mime: str, settings: Settings) -> OcrOutcome:
    engine = engine_name(settings)
    if engine is None:
        return OcrOutcome("unavailable", reason="no_engine")
    if mime not in IMAGE_MIMES:
        return OcrOutcome("unavailable", engine, reason="unsupported_type")
    outcome = _tesseract(path) if engine == "tesseract" else _vision(path, settings)
    if outcome.status == "done" and not outcome.text:
        return OcrOutcome("failed", outcome.engine, reason="empty_result")
    return outcome
