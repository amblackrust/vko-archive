"""Public content (T5.2, T5.3, T5.16): anonymous, published-only. Pages and FAQ are looked up by
the requested language with the catalog fallback order (ru, kk, en)."""

import logging

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.repositories import content as repo
from app.schemas.admin_cms import SETTING_MODELS
from app.schemas.content import (
    Contacts,
    FaqGroup,
    FaqItem,
    FaqResponse,
    PageDetail,
    PublicCounter,
    PublicSettings,
    PublicSocialLink,
    PublicSurvey,
    PublicUsefulLink,
)
from app.services.catalog import pick
from app.services.errors import NotFound
from app.services.sanitize import clean_html

logger = logging.getLogger(__name__)


def get_page(session: Session, key: str, lang: str) -> PageDetail:
    page = repo.published_page(session, key)
    if page is None:
        raise NotFound()
    title, _ = pick(page.title, lang)
    body, body_lang = pick(page.body, lang)
    return PageDetail(
        key=page.key,
        title=title,
        body=clean_html(body),
        lang=body_lang,
        translation_status=page.translation_status.get(body_lang, "missing"),
        seo_title=pick(page.seo_title, lang)[0],
        seo_description=pick(page.seo_description, lang)[0],
        seo_keywords=pick(page.seo_keywords, lang)[0],
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


def _setting(session: Session, key: str):
    """Validated setting value; a missing or old-shaped row gives the model defaults."""
    model = SETTING_MODELS[key]
    value = repo.setting_value(session, key)
    if value is None:
        return model()
    try:
        return model.model_validate(value)
    except ValidationError:
        logger.warning("site setting %s has an unexpected shape, using defaults", key)
        return model()


def get_public_settings(session: Session, lang: str) -> PublicSettings:
    social = _setting(session, "social")
    widgets = _setting(session, "widgets")
    survey = _setting(session, "survey")
    counter = _setting(session, "counter")
    useful = _setting(session, "useful_links")
    return PublicSettings(
        social={
            name: PublicSocialLink(url=link.url, handle=link.handle)
            for name, link in social
            if link.url
        },
        widgets=widgets.model_dump(),
        survey=PublicSurvey(
            enabled=survey.enabled and bool(pick(survey.question, lang)[0]),
            question=pick(survey.question, lang)[0],
            url=survey.url,
        ),
        counter=PublicCounter(enabled=counter.enabled, value=counter.base_value),
        useful_links=[
            PublicUsefulLink(title=pick(link.title, lang)[0], url=link.url)
            for link in useful.items
            if pick(link.title, lang)[0]
        ],
    )
