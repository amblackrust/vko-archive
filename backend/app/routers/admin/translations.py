"""Translations (T6.11): status per language, machine draft via the local Ollama, verification."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.deps import AppSettings, ClientIp, CurrentUser, DbSession
from app.schemas.translations import (
    AiUnavailableOut,
    Lang,
    MachineTranslateRequest,
    Status,
    TextTranslateOut,
    TextTranslateRequest,
    TranslationDetail,
    TranslationItem,
    TranslationPage,
    VerifyRequest,
)
from app.services import translations
from app.services.translations import TranslationView

router = APIRouter(prefix="/translations", tags=["admin: translations"])


def _item(object_type: str, obj: Any) -> TranslationItem:
    return TranslationItem(
        object_type=object_type,
        id=obj.id,
        label=translations.label(obj),
        workflow_status=obj.workflow_status.value,
        version=obj.version,
        translation_status=translations.statuses(obj),
    )


def _detail(view: TranslationView) -> TranslationDetail:
    return TranslationDetail(
        **_item(view.object_type, view.obj).model_dump(),
        fields=view.fields,
        can_machine_translate=view.can_machine_translate,
    )


def _unavailable(exc: translations.TranslationUnavailable) -> JSONResponse:
    return JSONResponse({"detail": exc.code, "reason": exc.reason}, status_code=503)


@router.get("", response_model=TranslationPage)
def list_translations(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    object_type: Annotated[str, Query(max_length=32)] = "document",
    lang: Lang | None = None,
    status: Status | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> TranslationPage:
    rows, total = translations.search(
        session, user, object_type, lang=lang, status=status, q=q, page=page, page_size=page_size, ip=ip
    )
    return TranslationPage(items=[_item(object_type, r) for r in rows], total=total, page=page, page_size=page_size)


@router.get("/{object_type}/{object_id}", response_model=TranslationDetail)
def get_translation(object_type: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp) -> TranslationDetail:
    return _detail(translations.get(session, user, object_type, object_id, ip=ip))


@router.post("/text", response_model=TextTranslateOut, responses={503: {"model": AiUnavailableOut}})
def translate_text(
    body: TextTranslateRequest, user: CurrentUser, session: DbSession, settings: AppSettings, ip: ClientIp
) -> TextTranslateOut | JSONResponse:
    """Stateless draft translation of one string (site settings forms); nothing is stored."""
    try:
        text = translations.translate_text(
            session, user, settings, body.text, source=body.source_lang, target=body.target_lang, ip=ip
        )
    except translations.TranslationUnavailable as exc:
        return _unavailable(exc)
    return TextTranslateOut(text=text)


@router.post(
    "/{object_type}/{object_id}/machine",
    response_model=TranslationDetail,
    responses={503: {"model": AiUnavailableOut}},
)
def machine_translate(
    object_type: str,
    object_id: uuid.UUID,
    body: MachineTranslateRequest,
    user: CurrentUser,
    session: DbSession,
    settings: AppSettings,
    ip: ClientIp,
) -> TranslationDetail | JSONResponse:
    try:
        view = translations.machine_translate(
            session, user, settings, object_type, object_id,
            source=body.source_lang, target=body.target_lang, version=body.version, overwrite=body.overwrite, ip=ip,
        )
    except translations.TranslationUnavailable as exc:
        return _unavailable(exc)
    return _detail(view)


@router.post("/{object_type}/{object_id}/verify", response_model=TranslationDetail)
def verify_translation(
    object_type: str, object_id: uuid.UUID, body: VerifyRequest, user: CurrentUser, session: DbSession, ip: ClientIp
) -> TranslationDetail:
    return _detail(
        translations.verify(session, user, object_type, object_id, lang=body.lang, version=body.version, ip=ip)
    )
