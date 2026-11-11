"""Staff AI tools (T4.9, T4.10): proposals only; changes are explicit calls (see services.ai_tools)."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Response, status
from fastapi.responses import JSONResponse

from app.deps import AppSettings, ClientIp, CurrentUser, DbSession
from app.schemas.ai_tools import (
    AiToolsStatus, AiUnavailableOut, AnalysisOut, AnalyzeIn, AnnotationEditIn, AnnotationGenerateIn, AnnotationOut,
    ApplyIn, ApplyOut, CollectionDraftIn, CollectionDraftOut, Lang, OcrApplyIn, OcrApplyOut, OcrProposal,
)
from app.services import ai_tools as service
from app.services import indexing

router = APIRouter(prefix="/ai-tools", tags=["admin: ai tools"])
_UNAVAILABLE = {503: {"model": AiUnavailableOut}}


def _unavailable(exc: service.AiUnavailable) -> JSONResponse:
    return JSONResponse({"detail": exc.code, "reason": exc.reason}, status_code=503)


@router.get("/status", response_model=AiToolsStatus)
def get_status(user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp) -> AiToolsStatus:
    return service.status(session, user, settings, ip=ip)


@router.post("/documents/{document_id}/analyze", response_model=AnalysisOut, responses=_UNAVAILABLE)
def analyze(
    document_id: uuid.UUID, body: AnalyzeIn, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp
) -> AnalysisOut | JSONResponse:
    try:
        return service.analyze(session, user, settings, document_id, body.lang, ip=ip)
    except service.AiUnavailable as exc:
        return _unavailable(exc)


@router.post("/documents/{document_id}/apply", response_model=ApplyOut)
def apply(
    document_id: uuid.UUID, body: ApplyIn, user: CurrentUser, session: DbSession, ip: ClientIp, background: BackgroundTasks
) -> ApplyOut:
    result = service.apply(session, user, document_id, body, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return result


@router.post("/files/{file_id}/ocr", response_model=OcrProposal, responses=_UNAVAILABLE)
def run_ocr(file_id: uuid.UUID, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp) -> OcrProposal:
    return service.ocr_file(session, user, settings, file_id, ip=ip)


@router.post("/files/{file_id}/ocr/apply", response_model=OcrApplyOut)
def apply_ocr(
    file_id: uuid.UUID, body: OcrApplyIn, user: CurrentUser, session: DbSession, ip: ClientIp, background: BackgroundTasks
) -> OcrApplyOut:
    file = service.apply_ocr(session, user, file_id, body.text, ip=ip)
    background.add_task(indexing.embed_pending_background, session.get_bind())
    return OcrApplyOut(file_id=file.id, ocr_status=file.ocr_status.value)


@router.get("/documents/{document_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(document_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> list[AnnotationOut]:
    return service.annotations(session, user, document_id, ip=ip)


@router.post("/documents/{document_id}/annotations/generate", response_model=AnnotationOut, responses=_UNAVAILABLE)
def generate_annotation(
    document_id: uuid.UUID, body: AnnotationGenerateIn, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp
) -> AnnotationOut | JSONResponse:
    try:
        return service.generate_annotation(session, user, settings, document_id, body.lang, ip=ip)
    except service.AiUnavailable as exc:
        return _unavailable(exc)


@router.put("/documents/{document_id}/annotations/{lang}", response_model=AnnotationOut)
def edit_annotation(
    document_id: uuid.UUID, lang: Lang, body: AnnotationEditIn, user: CurrentUser, session: DbSession, ip: ClientIp
) -> AnnotationOut:
    return service.edit_annotation(session, user, document_id, lang, body.text, ip=ip)


@router.post("/documents/{document_id}/annotations/{lang}/approve", response_model=AnnotationOut)
def approve_annotation(document_id: uuid.UUID, lang: Lang, user: CurrentUser, session: DbSession, ip: ClientIp) -> AnnotationOut:
    return service.approve_annotation(session, user, document_id, lang, ip=ip)


@router.delete("/documents/{document_id}/annotations/{lang}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_annotation(document_id: uuid.UUID, lang: Lang, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    service.withdraw_annotation(session, user, document_id, lang, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/collections/draft", response_model=CollectionDraftOut, responses=_UNAVAILABLE)
def draft_collection(
    body: CollectionDraftIn, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp
) -> CollectionDraftOut | JSONResponse:
    try:
        return service.draft_collection(session, user, settings, body.topic, body.lang, body.limit, ip=ip)
    except service.AiUnavailable as exc:
        return _unavailable(exc)
