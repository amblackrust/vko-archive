from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas.dashboard import Dashboard
from app.services import dashboard

router = APIRouter(prefix="/dashboard", tags=["admin: dashboard"])


@router.get("", response_model=Dashboard)
def get_dashboard(user: CurrentUser, session: DbSession) -> Dashboard:
    return dashboard.get(session, user)
