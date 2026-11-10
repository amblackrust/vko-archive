from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import AppSettings, DbSession
from app.schemas.search import SearchFilters, SearchResponse
from app.services import search as search_service

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
def search(filters: Annotated[SearchFilters, Query()], session: DbSession, settings: AppSettings) -> SearchResponse:
    """Unified public search. Repeat list params: `types=document&types=fund`, `doc_type=…`,
    `period=…`, `branch_id=…`."""
    return search_service.search(session, settings, filters)
