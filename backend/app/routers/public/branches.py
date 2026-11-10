from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbSession
from app.schemas.branches import BranchesResponse, BranchItem
from app.services import branches as branches_service

router = APIRouter(prefix="/branches", tags=["branches"])

Lang = Annotated[str, Query(pattern="^(kk|ru|en)$")]


@router.get("", response_model=BranchesResponse)
def branches(session: DbSession, lang: Lang = "ru") -> BranchesResponse:
    """Published branches. Coordinates are null for branches hidden from the map."""
    return branches_service.list_branches(session, lang)


@router.get("/{slug}", response_model=BranchItem)
def branch(slug: str, session: DbSession, lang: Lang = "ru") -> BranchItem:
    return branches_service.get_branch(session, slug, lang)
