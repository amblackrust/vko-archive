from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import AppSettings, ClientIp, CurrentUser, DbSession
from app.schemas.analytics import AiSummaryOut, AnalyticsReport
from app.schemas.ai_tools import Lang
from app.services import analytics as service

router = APIRouter(prefix="/analytics", tags=["admin: analytics"])
Days = Annotated[int, Query(ge=1, le=365)]


@router.get("", response_model=AnalyticsReport)
def get_report(user: CurrentUser, session: DbSession, ip: ClientIp, days: Days = 30) -> AnalyticsReport:
    return service.report(session, user, days, ip=ip)


@router.post("/ai-summary", response_model=AiSummaryOut)
def ai_summary(
    user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp, days: Days = 30, lang: Lang = "ru"
) -> AiSummaryOut:
    return service.ai_summary(session, user, settings, days, lang, ip=ip)
