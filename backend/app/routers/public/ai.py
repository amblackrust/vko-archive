import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.deps import AppSettings, ClientIp, DbSession
from app.schemas.ai import AiAnswer, AiParseResponse, AiRequest, AiStatus
from app.schemas.recommendations import RecommendationParams, RecommendationsResponse
from app.services import ai as ai_service
from app.services import ai_document, recommendations

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AiStatus)
def status(settings: AppSettings) -> AiStatus:
    """`ai_available: false` → the UI shows «ИИ временно недоступен, используйте поиск»."""
    return ai_service.status(settings)


@router.post("/parse", response_model=AiParseResponse)
def parse(request: AiRequest, session: DbSession, settings: AppSettings, ip: ClientIp) -> AiParseResponse:
    """Smart search: the query as filters (chips) and `/api/search` parameters."""
    ai_service.check_rate_limit(settings, ip)
    return ai_service.parse(session, settings, request)


@router.post("/answer", response_model=AiAnswer)
def answer(request: AiRequest, session: DbSession, settings: AppSettings, ip: ClientIp) -> AiAnswer:
    """AI summary over found public materials (whole answer at once)."""
    ai_service.check_rate_limit(settings, ip)
    prepared = ai_service.prepare(session, settings, request)
    return ai_service.answer(prepared, settings)


@router.post("/answer/stream")
def answer_stream(request: AiRequest, session: DbSession, settings: AppSettings, ip: ClientIp) -> StreamingResponse:
    """The same answer as NDJSON events: meta → delta* → done (see services.ai.stream).
    The database is read before the stream starts."""
    ai_service.check_rate_limit(settings, ip)
    prepared = ai_service.prepare(session, settings, request)
    return StreamingResponse(
        ai_service.ndjson(ai_service.stream(prepared, settings)),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/documents/{document_id}/answer", response_model=AiAnswer)
def document_answer(
    document_id: uuid.UUID, request: AiRequest, session: DbSession, settings: AppSettings, ip: ClientIp
) -> AiAnswer:
    """«Ask about this document» (T4.6): answer from the public document's own text, with
    sheet numbers. Not a public document → 404; files not open → fixed `restricted` text."""
    ai_service.check_rate_limit(settings, ip)
    prepared = ai_document.prepare(session, settings, document_id, request)
    return ai_service.answer(prepared, settings)


@router.post("/documents/{document_id}/answer/stream")
def document_answer_stream(
    document_id: uuid.UUID, request: AiRequest, session: DbSession, settings: AppSettings, ip: ClientIp
) -> StreamingResponse:
    """The document answer as NDJSON (same events as /answer/stream)."""
    ai_service.check_rate_limit(settings, ip)
    prepared = ai_document.prepare(session, settings, document_id, request)
    return StreamingResponse(
        ai_service.ndjson(ai_service.stream(prepared, settings)),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.get("/recommendations", response_model=RecommendationsResponse)
def similar_materials(params: Annotated[RecommendationParams, Query()], session: DbSession) -> RecommendationsResponse:
    """«Similar materials» (T4.12) for a public document / exhibition / collection / news /
    fund: by embeddings, with a tags/fund/title fallback. `seen` (repeated) — the visitor's
    recently viewed documents for personal recommendations; not stored. No model call."""
    return recommendations.recommend(session, params)
