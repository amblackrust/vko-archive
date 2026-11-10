from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbSession
from app.schemas.memory import (
    CollectionDetail,
    CollectionsResponse,
    MapPointsResponse,
    PersonDetail,
    PersonsResponse,
    TimelineResponse,
)
from app.services import memory as memory_service

router = APIRouter(prefix="/memory", tags=["memory"])

Lang = Annotated[str, Query(pattern="^(kk|ru|en)$")]


@router.get("/collections", response_model=CollectionsResponse)
def collections(
    session: DbSession,
    lang: Lang = "ru",
    q: Annotated[str, Query(max_length=200)] = "",
    theme: Annotated[str | None, Query(max_length=128)] = None,
    period: Annotated[str | None, Query(max_length=64)] = None,
) -> CollectionsResponse:
    return memory_service.list_collections(session, q, theme, period, lang)


@router.get("/collections/{slug}", response_model=CollectionDetail)
def collection(slug: str, session: DbSession, lang: Lang = "ru") -> CollectionDetail:
    return memory_service.get_collection(session, slug, lang)


@router.get("/persons", response_model=PersonsResponse)
def persons(session: DbSession, lang: Lang = "ru", q: Annotated[str, Query(max_length=200)] = "") -> PersonsResponse:
    return memory_service.list_persons(session, q, lang)


@router.get("/persons/{slug}", response_model=PersonDetail)
def person(slug: str, session: DbSession, lang: Lang = "ru") -> PersonDetail:
    return memory_service.get_person(session, slug, lang)


@router.get("/timeline", response_model=TimelineResponse)
def timeline(session: DbSession, lang: Lang = "ru") -> TimelineResponse:
    """Published events that have a date, ordered chronologically."""
    return memory_service.timeline(session, lang)


@router.get("/map-points", response_model=MapPointsResponse)
def map_points(session: DbSession, lang: Lang = "ru") -> MapPointsResponse:
    """Published historical objects and event places that have coordinates."""
    return memory_service.map_points(session, lang)
