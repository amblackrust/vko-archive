import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.deps import DbSession, OptionalUser
from app.schemas.catalog import (
    CaseDetail,
    CasesResponse,
    CatalogFilters,
    DocumentDetail,
    DocumentsResponse,
    FundDetail,
    FundListParams,
    FundsResponse,
    InventoriesResponse,
    InventoryDetail,
    PageParams,
)
from app.services import catalog as catalog_service

router = APIRouter(prefix="/catalog", tags=["catalog"])

Params = Annotated[PageParams, Query()]


@router.get("/documents", response_model=DocumentsResponse)
def documents(filters: Annotated[CatalogFilters, Query()], session: DbSession) -> DocumentsResponse:
    """Public documents with the ТЗ filters, sorting, pagination and facets. List params are repeated."""
    return catalog_service.search_documents(session, filters)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def document(
    document_id: uuid.UUID,
    session: DbSession,
    user: OptionalUser,
    response: Response,
    lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru",
) -> DocumentDetail:
    """Card of a public document; anything else is 404. `files` lists only what this
    user may open (restricted/closed -> empty), as /api/files URLs."""
    # The file list depends on the session cookie, so shared caches must not reuse it.
    response.headers["Cache-Control"] = "private, no-store"
    return catalog_service.get_document(session, user, document_id, lang)


@router.get("/funds", response_model=FundsResponse)
def funds(params: Annotated[FundListParams, Query()], session: DbSession) -> FundsResponse:
    return catalog_service.list_funds(session, params)


@router.get("/funds/{fund_id}", response_model=FundDetail)
def fund(fund_id: uuid.UUID, session: DbSession, lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru") -> FundDetail:
    return catalog_service.get_fund(session, fund_id, lang)


@router.get("/inventories", response_model=InventoriesResponse)
def inventories(params: Params, session: DbSession) -> InventoriesResponse:
    return catalog_service.list_inventories(session, params)


@router.get("/inventories/{inventory_id}", response_model=InventoryDetail)
def inventory(inventory_id: uuid.UUID, params: Params, session: DbSession) -> InventoryDetail:
    """Inventory with its cases (`page`, `per_page`, `q` apply to the cases)."""
    return catalog_service.get_inventory(session, inventory_id, params)


@router.get("/cases", response_model=CasesResponse)
def cases(params: Params, session: DbSession) -> CasesResponse:
    return catalog_service.list_cases(session, params)


@router.get("/cases/{case_id}", response_model=CaseDetail)
def case(case_id: uuid.UUID, params: Params, session: DbSession) -> CaseDetail:
    """Case with its public documents (`page`, `per_page`, `q` apply to the documents)."""
    return catalog_service.get_case(session, case_id, params)
