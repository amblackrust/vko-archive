from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.deps import DbSession
from app.schemas.exhibitions import ExhibitionDetail, ExhibitionList, ExhibitionParams
from app.services import exhibitions as exhibitions_service

router = APIRouter(tags=["exhibitions"])

Slug = Annotated[str, Path(pattern=r"^[a-z0-9-]{1,255}$")]


@router.get("/exhibitions", response_model=ExhibitionList)
def exhibitions(params: Annotated[ExhibitionParams, Query()], session: DbSession) -> ExhibitionList:
    """Published exhibitions with theme / period filters."""
    return exhibitions_service.list_exhibitions(session, params)


@router.get("/exhibitions/{slug}", response_model=ExhibitionDetail)
def exhibition(slug: Slug, session: DbSession, lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru") -> ExhibitionDetail:
    """Exhibition with its ordered exhibits; unpublished or unknown -> 404."""
    return exhibitions_service.get_exhibition(session, slug, lang)
