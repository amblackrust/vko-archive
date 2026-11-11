"""OCR of a scanned image for staff (T4.9): Tesseract `rus+kaz+eng` if installed, else a
vision model of Ollama (OLLAMA_VISION_MODEL) if it is pulled, else "unavailable".

The result is a proposal: the caller shows it to the employee, nothing is stored here.
Images are read directly; a PDF is rasterised page by page (pypdfium2, first MAX_PDF_PAGES
pages) and the pages' texts are joined with a form feed. Never raises for a missing engine.
"""

import base64
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.ai import ollama_client
from app.config import Settings
from app.services import pdf_render

logger = logging.getLogger(__name__)

TESSERACT_LANGS = "rus+kaz+eng"
TESSERACT_TIMEOUT_SECONDS = 180
MAX_VISION_BYTES = 10 * 1024 * 1024
IMAGE_MIMES = frozenset({"image/jpeg", "image/png", "image/tiff", "image/webp"})
PDF_MIME = "application/pdf"
MAX_PDF_PAGES = 50
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
            if ollama_client.has_model(settings, settings.ollama_vision_model):
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
    try:
        text = ollama_client.vision_text(VISION_PROMPT, image, settings, model=settings.ollama_vision_model)
    except ollama_client.OllamaUnavailable as exc:
        return OcrOutcome("failed", "vision", reason=exc.reason)
    return OcrOutcome("done", "vision", text)


def _recognize_pdf(path: Path, engine: str, settings: Settings) -> OcrOutcome:
    with tempfile.TemporaryDirectory(prefix="ocr-") as directory:
        try:
            pages = pdf_render.render_pages(path, Path(directory), scale=pdf_render.OCR_SCALE, limit=MAX_PDF_PAGES)
        except pdf_render.PdfRenderError as exc:
            logger.warning("PDF rendering for OCR failed: %s", exc)
            return OcrOutcome("failed", engine, reason="invalid_pdf")
        texts = []
        for page in pages:
            outcome = _tesseract(page) if engine == "tesseract" else _vision(page, settings)
            if outcome.status != "done":
                return outcome
            texts.append(outcome.text)
    # A page without text stays an empty slot, so page numbers keep their place.
    return OcrOutcome("done", engine, "\f".join(texts) if any(texts) else "")


def recognize(path: Path, mime: str, settings: Settings) -> OcrOutcome:
    engine = engine_name(settings)
    if engine is None:
        return OcrOutcome("unavailable", reason="no_engine")
    if mime == PDF_MIME:
        outcome = _recognize_pdf(path, engine, settings)
    elif mime in IMAGE_MIMES:
        outcome = _tesseract(path) if engine == "tesseract" else _vision(path, settings)
    else:
        return OcrOutcome("unavailable", engine, reason="unsupported_type")
    if outcome.status == "done" and not outcome.text:
        return OcrOutcome("failed", outcome.engine, reason="empty_result")
    return outcome
