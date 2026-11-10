from fastapi import APIRouter, Response, status

from app.deps import AppSettings, DbSession
from app.schemas.health import HealthResponse
from app.services import health as health_service

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(session: DbSession, settings: AppSettings, response: Response) -> HealthResponse:
    result = health_service.get_health(session, settings)
    # Ollama being down is a degraded (not failed) state; without the DB the API cannot serve.
    if result.db.status == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
