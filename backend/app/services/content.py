"""Public content (T5.2, T5.3, T5.16): anonymous, published-only. Pages and FAQ are looked up by
the requested language with the catalog fallback order (ru, kk, en)."""

from sqlalchemy.orm import Session

from app.repositories import content as repo
from app.schemas.content import Contacts, FaqGroup, FaqItem, FaqResponse, PageDetail
from app.services.catalog import pick
from app.services.errors import NotFound


def get_page(session: Session, key: str, lang: str) -> PageDetail:
    page = repo.published_page(session, key)
    if page is None:
        raise NotFound()
    title, _ = pick(page.title, lang)
    body, body_lang = pick(page.body, lang)
    return PageDetail(
        key=page.key,
        title=title,
        body=body,
        lang=body_lang,
        translation_status=page.translation_status.get(body_lang, "missing"),
    )


def list_faqs(session: Session, lang: str) -> FaqResponse:
    groups: dict[str, list[FaqItem]] = {}
    for faq in repo.published_faqs(session):
        question, _ = pick(faq.question, lang)
        answer, answer_lang = pick(faq.answer, lang)
        item = FaqItem(
            id=faq.id,
            question=question,
            answer=answer,
            lang=answer_lang,
            translation_status=faq.translation_status.get(answer_lang, "missing"),
        )
        groups.setdefault(faq.category, []).append(item)
    return FaqResponse(groups=[FaqGroup(category=c, items=items) for c, items in groups.items()])


def get_contacts(session: Session) -> Contacts:
    value = repo.setting_value(session, "contacts")
    if value is None:
        raise NotFound()
    return Contacts.model_validate(value)
