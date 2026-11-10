"""Context of the «ask about this document» mode (T4.6).

The caller (services.ai_document) passes only texts the public may read: the document's
public description and the OCR text of files that pass `authorize(None, "file.download")`
right now. Here the texts are split into page-numbered fragments, the fragments that fit
the context budget are chosen, and the text is neutralised as data: it cannot fake a
context marker, close the quoted query or break the one-line-per-item layout.
"""

import re
import uuid
from dataclasses import dataclass

from app.ai import rag
from app.services.indexing import chunk_text

FRAGMENT_CHARS = 900
MAX_FRAGMENTS = 8
MAX_OCR_CHARS = 6000  # num_ctx 8192 leaves room for the prompt, the description and the answer
DESCRIPTION_CHARS = 1500

# Tesseract and pdftotext separate pages with a form feed.
PAGE_BREAK = "\f"

_MARKER_RE = re.compile(r"[\[【]\s*S\s*\d{1,3}[^\]】\n]{0,20}[\]】]", re.IGNORECASE)
_QUOTE_BREAK_RE = re.compile(r"[<>＜＞‹›]+")
_WORD_RE = re.compile(r"\w{3,}")
_STEM = 5


@dataclass(frozen=True)
class PageText:
    """OCR text of one page of the digital copy (page numbers run through all files)."""

    page: int
    file_id: uuid.UUID
    text: str


@dataclass(frozen=True)
class Fragment:
    page: int
    file_id: uuid.UUID
    text: str


def as_data(text: str) -> str:
    """Document text as one line of data: no context markers ([S1]), no quote brackets,
    no line breaks (a line break would start a fake context item)."""
    text = rag.normalize(text or "")
    text = _MARKER_RE.sub(" ", text)
    text = _QUOTE_BREAK_RE.sub(" ", text)
    return " ".join(text.split())


def pages_of_files(files: list[tuple[uuid.UUID, int | None, str]]) -> list[PageText]:
    """(file_id, pages, ocr_text) in display order → page texts. A file covers `pages`
    pages (1 if unknown); its OCR text is split into pages at form feeds."""
    result: list[PageText] = []
    first_page = 1
    for file_id, pages, ocr_text in files:
        parts = (ocr_text or "").split(PAGE_BREAK)
        for offset, part in enumerate(parts):
            if part.strip():
                result.append(PageText(first_page + offset, file_id, part))
        first_page += max(pages or 1, len(parts))
    return result


def _stems(text: str) -> set[str]:
    return {word[:_STEM] for word in _WORD_RE.findall(text.lower())}


def select_fragments(pages: list[PageText], question: str) -> list[Fragment]:
    """All fragments if they fit the budget; otherwise those sharing most word stems with
    the question (ties: earlier pages first), shown in page order."""
    fragments = [
        Fragment(page.page, page.file_id, text)
        for page in pages
        for chunk in chunk_text(as_data(page.text), FRAGMENT_CHARS)
        if (text := chunk.strip())
    ]
    if len(fragments) <= MAX_FRAGMENTS and sum(len(f.text) for f in fragments) <= MAX_OCR_CHARS:
        return fragments
    wanted = _stems(question)
    ranked = sorted(range(len(fragments)), key=lambda i: (-len(wanted & _stems(fragments[i].text)), i))
    chosen: list[int] = []
    used = 0
    for index in ranked:
        size = len(fragments[index].text)
        if len(chosen) >= MAX_FRAGMENTS or used + size > MAX_OCR_CHARS:
            continue
        chosen.append(index)
        used += size
    return [fragments[i] for i in sorted(chosen)]
