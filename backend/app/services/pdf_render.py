"""PDF page rasterisation (pypdfium2, bundled PDFium: no system packages). PDFium is not
thread-safe, so rendering holds one process-wide lock; callers never keep it while they work
with the images (OCR can take minutes)."""

import threading
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image

_lock = threading.Lock()

# 180 dpi: readable for Tesseract without huge images.
OCR_SCALE = 2.5
PREVIEW_SCALE = 2.0


class PdfRenderError(Exception):
    pass


def render_pages(source: Path, directory: Path, *, scale: float, limit: int) -> list[Path]:
    """Renders the first `limit` pages to PNG files in `directory`; returns their paths in order.
    Raises PdfRenderError for an unreadable file."""
    with _lock:
        try:
            document = pdfium.PdfDocument(str(source))
        except pdfium.PdfiumError as exc:
            raise PdfRenderError(type(exc).__name__) from exc
        try:
            paths = []
            for index in range(min(len(document), limit)):
                target = directory / f"page-{index + 1:04d}.png"
                document[index].render(scale=scale).to_pil().convert("RGB").save(target, "PNG")
                paths.append(target)
            return paths
        except (pdfium.PdfiumError, OSError) as exc:
            raise PdfRenderError(type(exc).__name__) from exc
        finally:
            document.close()


def first_page(source: Path, *, scale: float = PREVIEW_SCALE) -> Image.Image:
    """The first page as an RGB image. Raises PdfRenderError for an unreadable or empty file."""
    with _lock:
        try:
            document = pdfium.PdfDocument(str(source))
        except pdfium.PdfiumError as exc:
            raise PdfRenderError(type(exc).__name__) from exc
        try:
            if len(document) == 0:
                raise PdfRenderError("empty")
            return document[0].render(scale=scale).to_pil().convert("RGB")
        except pdfium.PdfiumError as exc:
            raise PdfRenderError(type(exc).__name__) from exc
        finally:
            document.close()
