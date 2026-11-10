"""News and events (T5.14): public, read-only, published only.

Bodies are stored as HTML by the CMS and returned sanitized (services.sanitize.clean_html),
because the frontend renders them with dangerouslySetInnerHTML."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import News
from app.repositories import catalog as catalog_repo
from app.repositories import news as repo
from app.schemas.news import NewsDetail, NewsItem, NewsList, NewsMedia, NewsParams, RelatedRef
from app.services.catalog import pick
from app.services.errors import NotFound
from app.services.public_media import open_media, https_url
from app.services.sanitize import clean_html


def _item(session: Session, news: News, lang: str) -> NewsItem:
    title, title_lang = pick(news.title, lang)
    return NewsItem(
        id=news.id,
        slug=news.slug or "",
        href=f"/news/{news.slug}",
        title=title,
        title_lang=title_lang,
        summary=pick(news.summary, lang)[0],
        category=news.category,
        published_at=news.published_at,
        cover=open_media(session, news.cover_file_id),
        is_demo=news.is_demo,
        translation_status=news.translation_status.get(title_lang, "missing"),
    )


def list_news(session: Session, params: NewsParams) -> NewsList:
    total, rows = repo.search(
        session, params.category, params.q.strip(), params.sort == "date_desc", params.page, params.per_page
    )
    return NewsList(
        total=total,
        page=params.page,
        pages=repo.pages(total, params.per_page),
        items=[_item(session, n, params.lang) for n in rows],
        categories=repo.categories(session),
    )


def _media(session: Session, entries: list[dict[str, Any]]) -> list[NewsMedia]:
    out = []
    for entry in entries:
        file = None
        try:
            file = open_media(session, uuid.UUID(entry["file_id"])) if entry.get("file_id") else None
        except (ValueError, TypeError):
            file = None
        url = https_url(entry.get("url")) if isinstance(entry.get("url"), str) else None
        if file or url:
            out.append(NewsMedia(file=file, url=url))
    return out


def _related(session: Session, entries: list[dict[str, str]], lang: str) -> list[RelatedRef]:
    out = []
    for entry in entries:
        try:
            object_id = uuid.UUID(entry.get("id", ""))
        except ValueError:
            continue
        kind = entry.get("type")
        if kind == "document":
            row = catalog_repo.get_public_document(session, object_id)
            if row is not None:
                out.append(RelatedRef(type="document", id=object_id, title=pick(row.Document.title, lang)[0],
                                      href=f"/catalog/documents/{object_id}"))
        elif kind == "exhibition":
            ex = repo.published_exhibition(session, object_id)
            if ex is not None:
                out.append(RelatedRef(type="exhibition", id=object_id, title=pick(ex.title, lang)[0],
                                      href=f"/exhibitions/{ex.slug}"))
        elif kind == "news":
            other = repo.published_by_id(session, object_id)
            if other is not None:
                out.append(RelatedRef(type="news", id=object_id, title=pick(other.title, lang)[0],
                                      href=f"/news/{other.slug}"))
    return out


def get_news(session: Session, slug: str, lang: str) -> NewsDetail:
    news = repo.published_by_slug(session, slug)
    if news is None:
        raise NotFound()
    body, body_lang = pick(news.body, lang)
    return NewsDetail(
        **_item(session, news, lang).model_dump(),
        body=clean_html(body),
        body_lang=body_lang,
        media=_media(session, news.media),
        related=_related(session, news.related, lang),
    )
