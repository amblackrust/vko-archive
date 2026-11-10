"""«Ask about this document» (T4.6): an answer from one public document's own text.

Only a public document (published, description public) is accepted, any other id is 404
(as the card). The model is asked only about documents whose files are open; for others
the answer is a fixed text with the access conditions, without the model. The context is
the public description plus the OCR text of the files that pass
`authorize(None, "file.download")` at the moment of the question — the same live rule as
`/api/files`, so the text of a closed, restricted or unreviewed file never reaches the
model, whatever the index says. The visitor's session is ignored on purpose: staff rights
must not put closed text into a public feature.

The answer goes through the same stream and post-check as the assistant (services.ai):
markers only of context fragments, the document's own archive code only, no links.
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.ai import document as doc_context
from app.ai import guards, ollama_client, prompts, rag
from app.config import Settings
from app.models import Document
from app.models.enums import FileAccess
from app.repositories import catalog as catalog_repo
from app.repositories import files as files_repo
from app.schemas.ai import AiAnswer, AiRequest, AiSource
from app.services import files as files_service
from app.services.ai import EGOV, Prepared, _fixed, _resolve_lang, _section_item
from app.services.authz import FILE_DOWNLOAD, authorize
from app.services.catalog import pick
from app.services.errors import NotFound

SHEET_WORDS = {"ru": "лист", "kk": "парақ", "en": "sheet"}
DESCRIPTION_WORDS = {"ru": "описание документа", "kk": "құжат сипаттамасы", "en": "document description"}


def public_pages(session: Session, document: Document) -> list[doc_context.PageText]:
    """Page texts of the files an anonymous visitor may open now. Files that fail the
    check still count for page numbering, but their text is never read."""
    files = []
    for file in files_repo.files_of_owner(session, "document", document.id):
        allowed = authorize(None, FILE_DOWNLOAD, files_service.file_target(session, file, document))
        files.append((file.id, file.pages, file.ocr_text if allowed else None))
    return doc_context.pages_of_files(files)


def _context(document: Document, title: str, href: str, fragments: list[doc_context.Fragment], lang: str) -> rag.Context:
    description = doc_context.as_data(
        " ".join(part for part in (pick(document.summary, lang)[0], pick(document.historical_note, lang)[0]) if part)
    )
    base = {"type": "document", "id": document.id, "title": title, "href": href}
    first = rag.ContextItem(
        AiSource(ref="S1", **base, archive_code=document.archive_code, date_text=document.date_text,
                 doc_type=document.doc_type, access=document.file_access.value),
        rag.field_line(
            DESCRIPTION_WORDS[lang], doc_context.as_data(title), document.archive_code, document.date_text,
            rag.shorten(description, doc_context.DESCRIPTION_CHARS),
        ),
    )
    items = [first]
    for number, fragment in enumerate(fragments, 2):
        source = AiSource(ref=f"S{number}", **base, page=fragment.page, file_id=fragment.file_id)
        items.append(rag.ContextItem(source, rag.field_line(f"{SHEET_WORDS[lang]} {fragment.page}", fragment.text)))
    return rag.Context(items)


def prepare(session: Session, settings: Settings, document_id: uuid.UUID, request: AiRequest) -> Prepared:
    row = catalog_repo.get_public_document(session, document_id)
    if row is None:
        raise NotFound()
    document: Document = row.Document
    text = " ".join(request.q.split())
    lang = _resolve_lang(text, request.lang)
    guard = guards.check(text)
    available = ollama_client.availability(settings).available
    base: dict[str, Any] = {"query": text, "lang": lang, "ai_available": available, "injection_ignored": guard.injection}
    title = pick(document.title, lang)[0]
    href = f"/catalog/documents/{document.id}"
    card = AiSource(
        ref="S1", type="document", id=document.id, title=title, href=href, archive_code=document.archive_code,
        date_text=document.date_text, doc_type=document.doc_type, access=document.file_access.value,
        access_conditions=pick(document.access_conditions, lang)[0] or None,
    )
    texts = {"unavailable_texts": prompts.DOCUMENT_UNAVAILABLE, "not_found_texts": prompts.NO_INFO, "not_found_hints": []}

    if guard.verdict == "empty":
        return Prepared(_fixed(base, "empty", prompts.DOCUMENT_EMPTY), **texts)
    if guard.verdict == "off_topic":
        return Prepared(_fixed(base, "off_topic", prompts.OFF_TOPIC), **texts)
    if guard.service:
        sources = [_section_item(f"S{i}", key, lang).source for i, key in enumerate(("state_service", "paid_services"), 1)]
        return Prepared(_fixed(base, "service", prompts.SERVICE, sources=sources, links=[EGOV]), **texts)
    if document.file_access != FileAccess.OPEN:
        contacts = _section_item("S2", "contacts", lang).source
        return Prepared(_fixed(base, "restricted", prompts.DOCUMENT_RESTRICTED, sources=[card, contacts]), **texts)
    if not available:
        return Prepared(_fixed(base, "unavailable", prompts.DOCUMENT_UNAVAILABLE, sources=[card]), **texts)

    fragments = doc_context.select_fragments(public_pages(session, document), guard.query)
    context = _context(document, title, href, fragments, lang)
    messages = [
        {"role": "system", "content": prompts.document_system_prompt(lang)},
        {"role": "user", "content": prompts.document_message(guard.query, context.text())},
    ]
    result = AiAnswer(**base, mode="answer", ai_generated=True, label=prompts.AI_LABEL[lang], answer="")
    return Prepared(result, context, messages, no_answer_texts=prompts.NO_INFO, **texts)
