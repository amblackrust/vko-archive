from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.deps import DbSession
from app.schemas.news import NewsDetail, NewsList, NewsParams
from app.services import news as news_service

router = APIRouter(tags=["news"])

Slug = Annotated[str, Path(pattern=r"^[a-z0-9-]{1,255}$")]


@router.get("/news", response_model=NewsList)
def news_list(params: Annotated[NewsParams, Query()], session: DbSession) -> NewsList:
    """Published news: category, text search, date sorting, pagination."""
    return news_service.list_news(session, params)


@router.get("/news/{slug}", response_model=NewsDetail)
def news_item(slug: Slug, session: DbSession, lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru") -> NewsDetail:
    """News item with media and related materials; unpublished or unknown -> 404."""
    return news_service.get_news(session, slug, lang)
