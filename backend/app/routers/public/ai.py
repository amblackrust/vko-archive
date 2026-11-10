from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.deps import AppSettings, DbSession
from app.schemas.ai import AiAnswer, AiParseResponse, AiRequest, AiStatus
from app.services import ai as ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AiStatus)
def status(settings: AppSettings) -> AiStatus:
    """`ai_available: false` → the UI shows «ИИ временно недоступен, используйте поиск»."""
    return ai_service.status(settings)


@router.post("/parse", response_model=AiParseResponse)
def parse(request: AiRequest, session: DbSession, settings: AppSettings) -> AiParseResponse:
    """Smart search: the query as filters (chips) and `/api/search` parameters."""
    return ai_service.parse(session, settings, request)


@router.post("/answer", response_model=AiAnswer)
def answer(request: AiRequest, session: DbSession, settings: AppSettings) -> AiAnswer:
    """AI summary over found public materials (whole answer at once)."""
    prepared = ai_service.prepare(session, settings, request)
    return ai_service.answer(prepared, settings)


@router.post("/answer/stream")
def answer_stream(request: AiRequest, session: DbSession, settings: AppSettings) -> StreamingResponse:
    """The same answer as NDJSON events: meta → delta* → done (see services.ai.stream).
    The database is read before the stream starts."""
    prepared = ai_service.prepare(session, settings, request)
    return StreamingResponse(
        ai_service.ndjson(ai_service.stream(prepared, settings)),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
