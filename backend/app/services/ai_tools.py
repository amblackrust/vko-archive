"""AI tools for staff (T4.9, T4.10). Everything the model produces is a proposal.

- Reading tools (`analyze`, `ocr_file`, `draft_collection`) change nothing; they need `ai.use`
  plus access to the object, and are journaled (no texts in the journal).
- Changes happen only through explicit calls by an employee: `apply` (document fields, via
  `workflow.save_with_version`), `apply_ocr`, and the annotation steps edit / approve / withdraw.
  Nothing is published automatically; a public annotation exists only after `approve`.
- The staff analysis may read any text the employee may open (closed files in their branch).
  The public annotation is built ONLY from text an anonymous visitor may read right now
  (public description + OCR of files passing `authorize(None, FILE_DOWNLOAD)`).
"""

import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.ai import embeddings, ollama_client, tools, tools_ocr
from app.config import Settings
from app.models import DigitalFile, Document, DocumentAnnotation
from app.models.enums import AuditResult, OcrStatus
from app.repositories import ai_tools as repo
from app.repositories import files as files_repo
from app.repositories import recommendations as rec_repo
from app.schemas.ai_tools import (
    AiToolsStatus, AnalysisOut, AnnotationOut, ApplyIn, ApplyOut, CollectionDraftOut, DuplicateRef,
    OcrProposal, RelatedRef, TagSuggestion,
)
from app.services import ai_document, audit, indexing, recommendations, workflow
from app.services import files as files_service
from app.services.authz import FILE_DOWNLOAD, AuthUser, authorize, require
from app.services.catalog import pick
from app.services.errors import Conflict, InvalidInput, NotFound, ServiceError

logger = logging.getLogger(__name__)

DUPLICATE_DISTANCE = 0.12  # cosine distance of descriptions: nearly the same text
MAX_DUPLICATES = 5
RELATED_LIMIT = 6
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0e-\x1f\x7f]")


class AiUnavailable(ServiceError):
    """Ollama is down / model missing / busy / bad answer (→ HTTP 503 with a reason)."""

    code = "ai_unavailable"

    def __init__(self, reason: str) -> None:
        super().__init__()
        self.reason = reason


def _load(session: Session, document_id: uuid.UUID) -> Document:
    document = session.get(Document, document_id)
    if document is None:
        raise NotFound()
    return document


def _ref(document: Document) -> dict[str, Any]:
    return {
        "id": document.id, "title": pick(document.title, "ru")[0], "archive_code": document.archive_code,
        "workflow_status": document.workflow_status.value,
    }


def _journal(session: Session, user: AuthUser, action: str, object_type: str, object_id: uuid.UUID | None, ip: str | None, **details: Any) -> None:
    audit.record(
        session, action_type=f"ai_tools.{action}", result=AuditResult.SUCCESS, user=user,
        object_type=object_type, object_id=object_id, details=details, ip=ip,
    )


def status(session: Session, user: AuthUser, settings: Settings, *, ip: str | None) -> AiToolsStatus:
    require(session, user, "ai.use", ip=ip)
    availability = ollama_client.availability(settings)
    return AiToolsStatus(
        ai_available=availability.available, reason=availability.reason, ocr_engine=tools_ocr.engine_name(settings)
    )


def _ensure_ai(settings: Settings) -> None:
    availability = ollama_client.availability(settings)
    if not availability.available:
        raise AiUnavailable(availability.reason or "ollama_unavailable")


def _generate(call: Any, *args: Any) -> Any:
    try:
        return call(*args)
    except ollama_client.OllamaUnavailable as exc:
        raise AiUnavailable(exc.reason) from exc


def _staff_text(session: Session, user: AuthUser, document: Document, lang: str) -> tuple[str, list[DigitalFile]]:
    """Description plus OCR of the files this employee may open."""
    files = files_repo.files_of_owner(session, "document", document.id)
    parts = [
        pick(document.title, lang)[0], document.date_text or "", pick(document.authors, lang)[0],
        pick(document.summary, lang)[0], pick(document.historical_note, lang)[0],
    ]
    for file in files:
        if file.ocr_text and authorize(user, FILE_DOWNLOAD, files_service.file_target(session, file, document)):
            parts.append(file.ocr_text.replace("\f", "\n"))
    return "\n".join(part for part in parts if part), files


def _duplicates(session: Session, user: AuthUser, settings: Settings, document: Document, files: list[DigitalFile]) -> list[DuplicateRef]:
    """Same file (sha256) first, then documents with a nearly identical description (embeddings).
    Only documents this employee may see; the vector index holds public documents only."""
    found: dict[uuid.UUID, DuplicateRef] = {}
    own = {file.id for file in files}
    for file in files:
        owners = repo.documents_by_ids(session, list({f.owner_id for f in repo.files_with_hash(session, file.sha256, own) if f.owner_id}))
        for other in owners.values():
            if other.id != document.id and authorize(user, "catalog.view", other):
                found.setdefault(other.id, DuplicateRef(**_ref(other), reason="same_file"))
    rows = rec_repo.description_vectors(session, [("document", document.id)]).get(("document", document.id), [])
    vector = recommendations.query_vector(rows, [])
    if vector is None:
        try:
            text = " ".join(filter(None, (pick(document.title, "ru")[0], pick(document.summary, "ru")[0])))
            vector = embeddings.embed_texts([text], settings)[0] if text else None
        except embeddings.EmbeddingUnavailable:
            vector = None
    if vector is not None:
        near = rec_repo.nearest_objects(session, vector, ["document"], {document.id}, DUPLICATE_DISTANCE, MAX_DUPLICATES)
        others = repo.documents_by_ids(session, [object_id for _, object_id, _ in near])
        for _, object_id, distance in near:
            other = others.get(object_id)
            if other is not None and object_id not in found and authorize(user, "catalog.view", other):
                found[object_id] = DuplicateRef(**_ref(other), reason="similar", distance=round(distance, 4))
    return list(found.values())[:MAX_DUPLICATES]


def analyze(session: Session, user: AuthUser, settings: Settings, document_id: uuid.UUID, lang: str, *, ip: str | None) -> AnalysisOut:
    document = _load(session, document_id)
    require(session, user, "ai.use", ip=ip)
    require(session, user, "catalog.view", document, ip=ip)
    _ensure_ai(settings)
    text, files = _staff_text(session, user, document, lang)
    all_tags = repo.published_tags(session)
    tag_names = [pick(tag.name, lang)[0] for tag in all_tags]
    archive_code = document.archive_code
    session.rollback()  # the generation may take a while: do not hold the transaction
    result = _generate(tools.analyze, text, tag_names, lang, archive_code, settings)

    document = _load(session, document_id)
    related_keys, _ = recommendations.similar_keys(session, ("document", document.id), ["document"], [], RELATED_LIMIT)
    related_docs = repo.documents_by_ids(session, [object_id for _, object_id in related_keys])
    related = [
        RelatedRef(id=d.id, title=pick(d.title, lang)[0], href=f"/catalog/documents/{d.id}")
        for _, object_id in related_keys if (d := related_docs.get(object_id)) is not None
    ]
    _journal(session, user, "analyze", "document", document.id, ip, lang=lang)
    session.commit()
    return AnalysisOut(
        document_id=document.id, version=document.version, lang=lang,  # type: ignore[arg-type]
        text_chars=len(text), dates=result.dates, persons=result.persons, organizations=result.organizations,
        places=result.places, events=result.events, topics=result.topics,
        tags=[TagSuggestion(id=all_tags[n - 1].id, name=tag_names[n - 1]) for n in result.tag_numbers],
        summary=result.summary, related=related, duplicates=_duplicates(session, user, settings, document, files),
        label=tools.label(lang),
    )


def apply(session: Session, user: AuthUser, document_id: uuid.UUID, body: ApplyIn, *, ip: str | None) -> ApplyOut:
    """The employee accepted some proposed fields: written like any other edit (optimistic
    lock, version snapshot, re-index). Text is stored as the employee sent it, without a model."""
    document = _load(session, document_id)
    require(session, user, "catalog.edit", document, ip=ip)
    lang = body.lang
    values: dict[str, Any] = {}
    if body.summary is not None:
        values["summary"] = {**(document.summary or {}), lang: tools.clean_text(body.summary, document.archive_code, 2000)}
    if body.authors is not None:
        values["authors"] = {**(document.authors or {}), lang: " ".join(body.authors.split())}
    if body.date_text is not None:
        values["date_text"] = " ".join(body.date_text.split()) or None
    if body.places is not None:
        known = {place.get(lang, "") for place in document.places or []}
        added = [{lang: p} for p in dict.fromkeys(" ".join(p.split()) for p in body.places) if p and p not in known]
        values["places"] = [*(document.places or []), *added]
    applied = sorted(values)
    if body.tag_ids is not None:
        tags = repo.tags_by_ids(session, body.tag_ids)
        if len(tags) != len(set(body.tag_ids)):
            raise InvalidInput("unknown_tag")
        document.tags = list({tag.id: tag for tag in [*document.tags, *tags]}.values())
        session.flush()
        applied.append("tags")
    if not applied:
        raise InvalidInput("nothing_to_apply")
    try:
        version = workflow.save_with_version(session, user, "document", document, body.version, values, comment="AI proposal applied", ip=ip)
    except Conflict:
        session.rollback()
        raise
    _journal(session, user, "apply", "document", document.id, ip, fields=applied)
    session.commit()
    return ApplyOut(version=version, applied=applied)


# --- OCR ---------------------------------------------------------------------------------

def _ocr_file_and_owner(session: Session, user: AuthUser, file_id: uuid.UUID, ip: str | None) -> tuple[DigitalFile, Document]:
    file = files_repo.get_file(session, file_id)
    if file is None or file.owner_type != "document" or file.owner_id is None:
        raise NotFound()
    document = _load(session, file.owner_id)
    require(session, user, "files.upload", document, ip=ip)
    return file, document


def ocr_file(session: Session, user: AuthUser, settings: Settings, file_id: uuid.UUID, *, ip: str | None) -> OcrProposal:
    file, document = _ocr_file_and_owner(session, user, file_id, ip)
    require(session, user, "ai.use", ip=ip)
    path = files_service._resolve(settings.storage_dir, file.master_path)
    if path is None:
        raise NotFound()
    mime, owner_id = file.mime, document.id
    session.rollback()
    outcome = tools_ocr.recognize(path, mime, settings)
    file = files_repo.get_file(session, file_id)
    if file is not None and outcome.status != "done" and file.ocr_status == OcrStatus.NONE:
        file.ocr_status = OcrStatus.UNAVAILABLE if outcome.status == "unavailable" else OcrStatus.FAILED
    _journal(session, user, "ocr", "document", owner_id, ip, file_id=str(file_id), status=outcome.status, engine=outcome.engine)
    session.commit()
    return OcrProposal(file_id=file_id, status=outcome.status, engine=outcome.engine, reason=outcome.reason, text=outcome.text)  # type: ignore[arg-type]


def apply_ocr(session: Session, user: AuthUser, file_id: uuid.UUID, text: str, *, ip: str | None) -> DigitalFile:
    """The employee confirmed (possibly corrected) the recognised text. It reaches the search
    index only if the file is open to the public (indexing re-checks that)."""
    file, document = _ocr_file_and_owner(session, user, file_id, ip)
    # The text of an open file of a live document is searchable at once: no bypassing review.
    workflow.require_live_edit(session, user, document, ip=ip)
    clean = _CONTROL_RE.sub("", text).strip()
    if not clean:
        raise InvalidInput("empty_text")
    file.ocr_text = clean
    file.ocr_status = OcrStatus.DONE
    session.flush()
    indexing.reindex_file_owner(session, "document", document.id)
    _journal(session, user, "ocr_apply", "document", document.id, ip, file_id=str(file_id), chars=len(clean))
    session.commit()
    return file


# --- public annotation ---------------------------------------------------------------------

def _annotation_out(annotation: DocumentAnnotation) -> AnnotationOut:
    return AnnotationOut(
        lang=annotation.lang, text=annotation.text, status=annotation.status,  # type: ignore[arg-type]
        uses_file_text=annotation.uses_file_text, updated_at=annotation.updated_at,
        approved_at=annotation.approved_at, label=tools.label(annotation.lang),
    )


def annotations(session: Session, user: AuthUser, document_id: uuid.UUID, *, ip: str | None) -> list[AnnotationOut]:
    document = _load(session, document_id)
    require(session, user, "catalog.view", document, ip=ip)
    return [_annotation_out(a) for a in repo.annotations_of(session, document_id)]


def generate_annotation(
    session: Session, user: AuthUser, settings: Settings, document_id: uuid.UUID, lang: str, *, ip: str | None
) -> AnnotationOut:
    """A DRAFT annotation from public text only. Replaces an existing annotation of this
    language and takes it off the card until it is approved again."""
    document = _load(session, document_id)
    require(session, user, "catalog.edit", document, ip=ip)
    require(session, user, "ai.use", ip=ip)
    if not indexing.document_is_public(document):
        raise Conflict("not_public")
    pages = ai_document.public_pages(session, document)
    description = " ".join(filter(None, (pick(document.summary, lang)[0], pick(document.historical_note, lang)[0])))
    public_text = "\n".join([description, *(page.text for page in pages)]).strip()
    if not public_text:
        raise Conflict("no_source_text")
    _ensure_ai(settings)
    title, archive_code = pick(document.title, lang)[0], document.archive_code
    uses_file_text = bool(pages)
    session.rollback()
    text = _generate(tools.annotation, public_text, title, lang, archive_code, settings)
    if not text:
        raise AiUnavailable("bad_response")
    annotation = repo.get_annotation(session, document_id, lang)
    if annotation is None:
        annotation = DocumentAnnotation(document_id=document_id, lang=lang, text=text)
        session.add(annotation)
    annotation.text, annotation.status, annotation.uses_file_text = text, "draft", uses_file_text
    annotation.model, annotation.created_by = settings.ollama_model, user.id
    annotation.approved_by = annotation.approved_at = None
    _journal(session, user, "annotation_generate", "document", document_id, ip, lang=lang)
    session.commit()
    session.refresh(annotation)
    return _annotation_out(annotation)


def _own_annotation(session: Session, user: AuthUser, document_id: uuid.UUID, lang: str, ip: str | None) -> tuple[Document, DocumentAnnotation]:
    document = _load(session, document_id)
    require(session, user, "catalog.edit", document, ip=ip)
    annotation = repo.get_annotation(session, document_id, lang)
    if annotation is None:
        raise NotFound()
    return document, annotation


def edit_annotation(session: Session, user: AuthUser, document_id: uuid.UUID, lang: str, text: str, *, ip: str | None) -> AnnotationOut:
    document, annotation = _own_annotation(session, user, document_id, lang, ip)
    clean = tools.clean_text(text, document.archive_code, tools.MAX_SUMMARY_CHARS)
    if not clean:
        raise InvalidInput("empty_text")
    annotation.text, annotation.status = clean, "draft"
    annotation.approved_by = annotation.approved_at = None
    _journal(session, user, "annotation_edit", "document", document_id, ip, lang=lang)
    session.commit()
    session.refresh(annotation)
    return _annotation_out(annotation)


def approve_annotation(session: Session, user: AuthUser, document_id: uuid.UUID, lang: str, *, ip: str | None) -> AnnotationOut:
    document, annotation = _own_annotation(session, user, document_id, lang, ip)
    if not indexing.document_is_public(document):
        raise Conflict("not_public")
    # Approval puts the text on the public card: the same right as publishing.
    require(session, user, "workflow.publish", document, ip=ip)
    annotation.status, annotation.approved_by, annotation.approved_at = "approved", user.id, datetime.now(UTC)
    _journal(session, user, "annotation_approve", "document", document_id, ip, lang=lang)
    session.commit()
    session.refresh(annotation)
    return _annotation_out(annotation)


def withdraw_annotation(session: Session, user: AuthUser, document_id: uuid.UUID, lang: str, *, ip: str | None) -> None:
    _, annotation = _own_annotation(session, user, document_id, lang, ip)
    session.delete(annotation)
    _journal(session, user, "annotation_withdraw", "document", document_id, ip, lang=lang)
    session.commit()


# --- thematic selection draft ----------------------------------------------------------------

def draft_collection(
    session: Session, user: AuthUser, settings: Settings, topic: str, lang: str, limit: int, *, ip: str | None
) -> CollectionDraftOut:
    """Draft title/description and public documents on a topic (by embeddings). Not saved anywhere."""
    require(session, user, "ai.use", ip=ip)
    _ensure_ai(settings)
    vector = embeddings.embed_query(" ".join(topic.split()), settings, timeout=settings.ollama_embed_timeout_seconds)
    if vector is None:
        raise AiUnavailable("embeddings_unavailable")
    near = rec_repo.nearest_objects(session, vector, ["document"], set(), recommendations.MAX_DISTANCE, limit * 2)
    documents = repo.documents_by_ids(session, [object_id for _, object_id, _ in near])
    chosen = [d for _, object_id, _ in near if (d := documents.get(object_id)) is not None and indexing.document_is_public(d)][:limit]
    if not chosen:
        raise Conflict("no_materials")
    materials = [(pick(d.title, lang)[0], pick(d.summary, lang)[0]) for d in chosen]
    items = [RelatedRef(id=d.id, title=pick(d.title, lang)[0], href=f"/catalog/documents/{d.id}") for d in chosen]
    session.rollback()
    draft = _generate(tools.collection_draft, topic, materials, lang, settings)
    _journal(session, user, "collection_draft", "collection", None, ip, lang=lang, items=len(items))
    session.commit()
    return CollectionDraftOut(title=draft["title"], description=draft["description"], items=items, label=tools.label(lang))
