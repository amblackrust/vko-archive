from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from app import security
from app.config import Settings, get_settings
from app.db import get_session
from app.services import auth as auth_service
from app.services.auth import AuthSession
from app.services.authz import AuthUser
from app.services.errors import CsrfFailed, NotAuthenticated

DbSession = Annotated[Session, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


ClientIp = Annotated[str | None, Depends(client_ip)]


def set_session_cookies(response: Response, settings: Settings, auth: AuthSession) -> None:
    max_age = settings.session_idle_minutes * 60
    response.set_cookie(
        security.SESSION_COOKIE, auth.token, max_age=max_age, httponly=True,
        secure=settings.session_cookie_secure, samesite="strict", path="/",
    )
    # Readable by the frontend, which echoes it in the X-CSRF-Token header.
    response.set_cookie(
        security.CSRF_COOKIE, auth.csrf, max_age=max_age, httponly=False,
        secure=settings.session_cookie_secure, samesite="strict", path="/",
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(security.SESSION_COOKIE, path="/", secure=settings.session_cookie_secure, httponly=True, samesite="strict")
    response.delete_cookie(security.CSRF_COOKIE, path="/", secure=settings.session_cookie_secure, samesite="strict")


# Sent by the frontend on polling requests (notification bell, etc.). Such requests
# authenticate but do not renew the session, so the inactivity timeout still fires.
BACKGROUND_HEADER = "X-Background"


def _authenticate(request: Request, session: Session, settings: Settings) -> AuthSession:
    return auth_service.authenticate(
        session,
        settings,
        request.cookies.get(security.SESSION_COOKIE),
        method=request.method,
        csrf_header=request.headers.get(security.CSRF_HEADER),
    )


def get_auth_session(request: Request, response: Response, session: DbSession, settings: AppSettings) -> AuthSession:
    """Staff session from the cookie; checks CSRF on unsafe methods and renews the cookie
    (sliding inactivity timeout) unless the request is marked as background."""
    auth = _authenticate(request, session, settings)
    if request.headers.get(BACKGROUND_HEADER) != "1":
        set_session_cookies(response, settings, auth)
    return auth


def get_background_session(request: Request, session: DbSession, settings: AppSettings) -> AuthSession:
    """Like get_auth_session but never renews: for endpoints that are only polled."""
    return _authenticate(request, session, settings)


CurrentSession = Annotated[AuthSession, Depends(get_auth_session)]


def get_current_user(auth: CurrentSession) -> AuthUser:
    return auth.user


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


def get_background_user(auth: Annotated[AuthSession, Depends(get_background_session)]) -> AuthUser:
    return auth.user


BackgroundUser = Annotated[AuthUser, Depends(get_background_user)]


def get_optional_user(request: Request, session: DbSession, settings: AppSettings) -> AuthUser | None:
    """For public endpoints (e.g. file download): the staff user if a valid session
    cookie is present, otherwise None (anonymous). No renewal. On unsafe methods the CSRF
    header is checked; without it the request is served as anonymous (never with the
    staff user's rights). Without JWT_SECRET (development only) everyone is anonymous."""
    token = request.cookies.get(security.SESSION_COOKIE)
    if not token or settings.jwt_secret is None:
        return None
    try:
        return _authenticate(request, session, settings).user
    except (NotAuthenticated, CsrfFailed):
        return None


OptionalUser = Annotated[AuthUser | None, Depends(get_optional_user)]
