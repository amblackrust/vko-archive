"""Visitor cabinet API (T5.18): `/api/cabinet`. Authentication is the visitor's own cookie
session (see services.visitor_auth); staff sessions are not accepted here and visitor sessions
are not accepted anywhere else."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.config import Settings
from app.deps import AppSettings, ClientIp, DbSession
from app.models import Visitor
from app.schemas.cabinet import (
    ChangePasswordRequest,
    FavoriteItem,
    FavoriteRef,
    FavoriteStatus,
    FavoriteType,
    Lang,
    LoginRequest,
    RegisterRequest,
    SearchCreate,
    SearchEntry,
    Selection,
    SelectionCreate,
    SelectionItemAdd,
    Subscriptions,
    Topic,
    VisitorMe,
)
from app.security import CSRF_HEADER
from app.services import cabinet as cabinet_service
from app.services import visitor_auth as auth_service
from app.services.visitor_auth import VISITOR_COOKIE, VISITOR_CSRF_COOKIE, VisitorSession

router = APIRouter(prefix="/cabinet", tags=["cabinet"])


def _set_cookies(response: Response, settings: Settings, auth: VisitorSession) -> None:
    max_age = settings.session_idle_minutes * 60
    response.set_cookie(VISITOR_COOKIE, auth.token, max_age=max_age, httponly=True,
                        secure=settings.session_cookie_secure, samesite="strict", path="/")
    response.set_cookie(VISITOR_CSRF_COOKIE, auth.csrf, max_age=max_age, httponly=False,
                        secure=settings.session_cookie_secure, samesite="strict", path="/")


def _clear_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(VISITOR_COOKIE, path="/", secure=settings.session_cookie_secure, httponly=True, samesite="strict")
    response.delete_cookie(VISITOR_CSRF_COOKIE, path="/", secure=settings.session_cookie_secure, samesite="strict")


def _session(request: Request, response: Response, session: DbSession, settings: AppSettings) -> VisitorSession:
    auth = auth_service.authenticate(
        session, settings, request.cookies.get(VISITOR_COOKIE),
        method=request.method, csrf_header=request.headers.get(CSRF_HEADER),
    )
    _set_cookies(response, settings, auth)  # sliding inactivity timeout
    return auth


CurrentSession = Annotated[VisitorSession, Depends(_session)]


def _me(auth: VisitorSession) -> VisitorMe:
    return VisitorMe(id=auth.visitor.id, email=auth.visitor.email, display_name=auth.visitor.display_name, csrf_token=auth.csrf)


def _visitor(auth: CurrentSession) -> Visitor:
    return auth.visitor


CurrentVisitor = Annotated[Visitor, Depends(_visitor)]


@router.post("/auth/register", response_model=VisitorMe, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, response: Response, session: DbSession, settings: AppSettings, ip: ClientIp) -> VisitorMe:
    auth = auth_service.register(session, settings, body.email, body.password, body.display_name, ip=ip)
    _set_cookies(response, settings, auth)
    return _me(auth)


@router.post("/auth/login", response_model=VisitorMe)
def login(body: LoginRequest, response: Response, session: DbSession, settings: AppSettings, ip: ClientIp) -> VisitorMe:
    auth = auth_service.login(session, settings, body.email, body.password, ip=ip)
    _set_cookies(response, settings, auth)
    return _me(auth)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(visitor: CurrentVisitor, session: DbSession, settings: AppSettings) -> Response:
    auth_service.logout(session, visitor)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_cookies(response, settings)
    return response


@router.post("/auth/password", response_model=VisitorMe)
def change_password(body: ChangePasswordRequest, response: Response, auth: CurrentSession, session: DbSession, settings: AppSettings) -> VisitorMe:
    """Changes the password; the other sessions of the visitor sign out, this one is renewed."""
    renewed = auth_service.change_password(session, settings, auth, body.current_password, body.new_password)
    _set_cookies(response, settings, renewed)
    return _me(renewed)


@router.get("/me", response_model=VisitorMe)
def me(auth: CurrentSession) -> VisitorMe:
    return _me(auth)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(visitor: CurrentVisitor, session: DbSession, settings: AppSettings) -> Response:
    """Deletes the account with all its cabinet data."""
    cabinet_service.delete_account(session, visitor)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_cookies(response, settings)
    return response


@router.get("/favorites", response_model=list[FavoriteItem])
def favorites(visitor: CurrentVisitor, session: DbSession, lang: Lang = "ru") -> list[FavoriteItem]:
    return cabinet_service.list_favorites(session, visitor, lang)


@router.get("/favorites/check", response_model=FavoriteStatus)
def favorite_status(
    visitor: CurrentVisitor, session: DbSession, type: Annotated[FavoriteType, Query()], id: Annotated[uuid.UUID, Query()]
) -> FavoriteStatus:
    return FavoriteStatus(favorite=cabinet_service.is_favorite(session, visitor, type, id))


@router.post("/favorites", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(body: FavoriteRef, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.add_favorite(session, visitor, body.type, body.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/favorites/{type}/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(type: FavoriteType, id: uuid.UUID, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.remove_favorite(session, visitor, type, id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/selections", response_model=list[Selection])
def selections(visitor: CurrentVisitor, session: DbSession, lang: Lang = "ru") -> list[Selection]:
    return cabinet_service.list_selections(session, visitor, lang)


@router.post("/selections", response_model=Selection, status_code=status.HTTP_201_CREATED)
def create_selection(body: SelectionCreate, visitor: CurrentVisitor, session: DbSession) -> Selection:
    return cabinet_service.create_selection(session, visitor, body.title)


@router.delete("/selections/{selection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_selection(selection_id: uuid.UUID, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.delete_selection(session, visitor, selection_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/selections/{selection_id}/items", status_code=status.HTTP_204_NO_CONTENT)
def add_selection_item(selection_id: uuid.UUID, body: SelectionItemAdd, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.add_to_selection(session, visitor, selection_id, body.document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/selections/{selection_id}/items/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_selection_item(selection_id: uuid.UUID, document_id: uuid.UUID, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.remove_from_selection(session, visitor, selection_id, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/searches", response_model=list[SearchEntry])
def searches(visitor: CurrentVisitor, session: DbSession) -> list[SearchEntry]:
    return cabinet_service.list_searches(session, visitor)


@router.post("/searches", status_code=status.HTTP_204_NO_CONTENT)
def add_search(body: SearchCreate, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.add_search(session, visitor, body.query)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/searches", status_code=status.HTTP_204_NO_CONTENT)
def clear_searches(visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.clear_searches(session, visitor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_search(search_id: uuid.UUID, visitor: CurrentVisitor, session: DbSession) -> Response:
    cabinet_service.delete_search(session, visitor, search_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/subscriptions", response_model=Subscriptions)
def subscriptions(visitor: CurrentVisitor, session: DbSession) -> Subscriptions:
    return cabinet_service.get_subscriptions(session, visitor)


@router.put("/subscriptions/{topic}", response_model=Subscriptions)
def subscribe(topic: Topic, visitor: CurrentVisitor, session: DbSession) -> Subscriptions:
    return cabinet_service.set_subscription(session, visitor, topic, True)


@router.delete("/subscriptions/{topic}", response_model=Subscriptions)
def unsubscribe(topic: Topic, visitor: CurrentVisitor, session: DbSession) -> Subscriptions:
    return cabinet_service.set_subscription(session, visitor, topic, False)
