from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbSession
from app.schemas.legal import CompliancePage, LegalActParams, LegalActsResponse
from app.services import legal as legal_service

router = APIRouter(tags=["legal"])


@router.get("/legal-acts", response_model=LegalActsResponse)
def legal_acts(params: Annotated[LegalActParams, Query()], session: DbSession) -> LegalActsResponse:
    """Published legal acts (NPA) with requisites, status and open files."""
    return legal_service.list_acts(session, params)


@router.get("/compliance", response_model=CompliancePage)
def compliance(
    session: DbSession,
    lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru",
) -> CompliancePage:
    """Compliance page with its open materials; unpublished page -> 404."""
    return legal_service.get_compliance(session, lang)
