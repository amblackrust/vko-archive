"""Online exhibitions (T5.13): public, read-only, published only. Exhibit files and the link to
the catalog card are offered only when the document / file is public for anonymous visitors."""

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import Exhibit as ExhibitModel
from app.models import Exhibition
from app.repositories import exhibitions as repo
from app.schemas.exhibitions import Exhibit, ExhibitionDetail, ExhibitionItem, ExhibitionList, ExhibitionParams
from app.services.catalog import pick
from app.services.errors import NotFound
from app.services.public_media import https_url, open_media


def _item(session: Session, ex: Exhibition, exhibits: list[ExhibitModel], lang: str) -> ExhibitionItem:
    title, title_lang = pick(ex.title, lang)
    intro, intro_lang = pick(ex.intro, lang)
    cover = open_media(session, ex.cover_file_id)
    if cover is None:  # fall back to the first exhibit that has an open image
        cover = next((m for e in exhibits if (m := open_media(session, e.media_file_id))), None)
    return ExhibitionItem(
        id=ex.id,
        slug=ex.slug or str(ex.id),
        href=f"/exhibitions/{ex.slug}",
        title=title,
        title_lang=title_lang,
        theme=ex.theme,
        period=ex.period,
        intro=intro,
        cover=cover,
        exhibits_count=len(exhibits),
        is_demo=ex.is_demo,
        translation_status=ex.translation_status.get(intro_lang, "missing"),
    )


def list_exhibitions(session: Session, params: ExhibitionParams) -> ExhibitionList:
    found = repo.published_exhibitions(session, params.theme, params.period, params.q.strip())
    grouped: dict[uuid.UUID, list[ExhibitModel]] = defaultdict(list)
    for exhibit in repo.published_exhibits(session, [ex.id for ex in found]):
        grouped[exhibit.exhibition_id].append(exhibit)
    themes, periods = repo.facet_values(session)
    return ExhibitionList(
        total=len(found),
        items=[_item(session, ex, grouped[ex.id], params.lang) for ex in found],
        themes=themes,
        periods=periods,
    )


def get_exhibition(session: Session, slug: str, lang: str) -> ExhibitionDetail:
    ex = repo.published_by_slug(session, slug)
    if ex is None:
        raise NotFound()
    exhibits = repo.published_exhibits(session, [ex.id])
    public_docs = repo.public_document_ids(session, [e.document_id for e in exhibits if e.document_id])
    return ExhibitionDetail(
        **_item(session, ex, exhibits, lang).model_dump(),
        exhibits=[
            Exhibit(
                id=e.id,
                position=number,
                title=pick(e.title, lang)[0],
                caption=pick(e.caption, lang)[0],
                source=pick(e.source, lang)[0],
                archive_code=e.archive_code,
                media=open_media(session, e.media_file_id),
                video_url=https_url(e.media_url),
                document_href=f"/catalog/documents/{e.document_id}" if e.document_id in public_docs else None,
                is_demo=e.is_demo,
            )
            for number, e in enumerate(exhibits, start=1)
        ],
    )
