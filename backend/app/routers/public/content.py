from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.deps import DbSession
from app.schemas.content import Contacts, FaqResponse, Lang, PageDetail
from app.services import content as content_service

router = APIRouter(tags=["content"])

PageKey = Annotated[str, Path(pattern=r"^[a-z0-9-]{1,128}$")]


@router.get("/pages/{key}", response_model=PageDetail)
def page(key: PageKey, session: DbSession, lang: Lang = "ru") -> PageDetail:
    """Published information page (e.g. `history`, `structure`); anything else is 404."""
    return content_service.get_page(session, key, lang)


@router.get("/faqs", response_model=FaqResponse)
def faqs(session: DbSession, lang: Annotated[Lang, Query()] = "ru") -> FaqResponse:
    """Published FAQ grouped by topic (`category`)."""
    return content_service.list_faqs(session, lang)


@router.get("/contacts", response_model=Contacts)
def contacts(session: DbSession) -> Contacts:
    return content_service.get_contacts(session)
