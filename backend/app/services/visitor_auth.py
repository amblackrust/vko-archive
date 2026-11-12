"""Visitor accounts of the cabinet (T5.18), fully separate from staff (T6.1).

* Own table, own cookies (`vko_visitor`, `vko_visitor_csrf`) and own JWT audience, so a visitor
  token is rejected by the staff session decoder (and vice versa) and a visitor never becomes an
  `AuthUser`: every other endpoint, including file download, still sees an anonymous request.
* Passwords: argon2id via app.security. Lockout: `login_max_attempts` wrong passwords lock the
  account for `login_lock_minutes`; locked / inactive / unknown all answer 401 `invalid_credentials`
  with the same argon2 work. Per-IP sliding-window limits cap registration and login attempts.
* CSRF: the token lives in the JWT and must be echoed in X-CSRF-Token on unsafe methods.
* Nothing about a visitor's password or token is logged or journaled.
"""

import hmac
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import security
from app.config import Settings
from app.models import Visitor
from app.repositories import cabinet as repo
from app.services.auth import normalize_email, validate_new_password
from app.services.errors import Conflict, CsrfFailed, InvalidCredentials, InvalidInput, NotAuthenticated, RateLimited
from app.services.rate_limit import RateLimiter

VISITOR_COOKIE = "vko_visitor"
VISITOR_CSRF_COOKIE = "vko_visitor_csrf"
AUDIENCE = "visitor"
REGISTER_PER_MINUTE = 5
LOGIN_PER_MINUTE = 20

limiter = RateLimiter()
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class VisitorSession:
    visitor: Visitor
    csrf: str
    token: str


def _key(settings: Settings) -> str:
    if settings.jwt_secret is None:
        raise RuntimeError("JWT_SECRET is not configured")
    return settings.jwt_secret.get_secret_value()


def _issue(settings: Settings, visitor: Visitor, csrf: str, auth_time: datetime) -> VisitorSession:
    now = datetime.now(UTC)
    expires = min(
        now + timedelta(minutes=settings.session_idle_minutes), auth_time + timedelta(hours=settings.session_max_hours)
    )
    payload = {
        "sub": str(visitor.id),
        "aud": AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "auth_time": int(auth_time.timestamp()),
        "csrf": csrf,
        "pwv": security.password_version(visitor.password_changed_at),
        "sev": visitor.session_version,
    }
    return VisitorSession(visitor, csrf, jwt.encode(payload, _key(settings), algorithm=security.JWT_ALGORITHM))


def _check_limit(key: str, limit: int) -> None:
    wait = limiter.hit(key, limit)
    if wait is not None:
        raise RateLimited(wait)


def register(
    session: Session, settings: Settings, email: str, password: str, display_name: str, *, ip: str | None
) -> VisitorSession:
    _check_limit(f"register:{ip}", REGISTER_PER_MINUTE)
    email = normalize_email(email)
    if len(email) > 320 or not _EMAIL.match(email):
        raise InvalidInput("invalid_email")
    validate_new_password(password)
    if repo.visitor_by_email(session, email) is not None:
        raise Conflict("email_taken")
    now = datetime.now(UTC)
    visitor = Visitor(
        email=email,
        password_hash=security.hash_password(password),
        display_name=" ".join(display_name.split()),
        password_changed_at=now,
    )
    session.add(visitor)
    try:
        session.commit()
    except IntegrityError as exc:  # concurrent registration of the same e-mail
        session.rollback()
        raise Conflict("email_taken") from exc
    return _issue(settings, visitor, security.new_csrf_token(), now)


def login(session: Session, settings: Settings, email: str, password: str, *, ip: str | None) -> VisitorSession:
    _check_limit(f"visitor-login:{ip}", LOGIN_PER_MINUTE)
    now = datetime.now(UTC)
    visitor = repo.visitor_by_email(session, normalize_email(email), for_update=True)
    # One argon2 verify whatever the account state: equal timing for every outcome.
    password_ok = security.verify_password(visitor.password_hash if visitor else None, password)
    if visitor is None:
        raise InvalidCredentials()
    if visitor.locked_until is not None and visitor.locked_until > now:
        session.rollback()
        raise InvalidCredentials()
    if not password_ok:
        visitor.failed_logins += 1
        if visitor.failed_logins >= settings.login_max_attempts:
            visitor.failed_logins = 0
            visitor.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
        session.commit()
        raise InvalidCredentials()
    if not visitor.is_active:
        session.rollback()
        raise InvalidCredentials()
    visitor.failed_logins = 0
    visitor.locked_until = None
    if security.password_needs_rehash(visitor.password_hash):
        visitor.password_hash = security.hash_password(password)
    session.commit()
    return _issue(settings, visitor, security.new_csrf_token(), now)


GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"


def login_google(session: Session, settings: Settings, credential: str, *, ip: str | None) -> VisitorSession:
    """Signs in (or registers) a visitor by a Google ID token.

    Google itself validates the signature and expiry on `tokeninfo`; we check the audience (our client id)
    and that Google verified the e-mail. A new visitor gets a random password nobody knows, so only Google
    (or a password reset by e-mail) opens the account.
    """
    if not settings.google_client_id:
        raise InvalidInput("google_not_configured")
    _check_limit(f"visitor-login:{ip}", LOGIN_PER_MINUTE)
    try:
        resp = httpx.get(GOOGLE_TOKENINFO, params={"id_token": credential}, timeout=5.0)
    except httpx.HTTPError as exc:
        raise InvalidInput("google_unavailable") from exc
    claims = resp.json() if resp.status_code == 200 else {}
    email = normalize_email(str(claims.get("email", "")))
    if (
        claims.get("aud") != settings.google_client_id
        or str(claims.get("email_verified")).lower() != "true"
        or not _EMAIL.match(email)
    ):
        raise InvalidCredentials()
    now = datetime.now(UTC)
    visitor = repo.visitor_by_email(session, email, for_update=True)
    if visitor is None:
        visitor = Visitor(
            email=email,
            password_hash=security.hash_password(secrets.token_urlsafe(32)),
            display_name=" ".join(str(claims.get("name") or email.split("@")[0]).split())[:100],
            password_changed_at=now,
            email_confirmed_at=now,
        )
        session.add(visitor)
    elif not visitor.is_active:
        session.rollback()
        raise InvalidCredentials()
    elif visitor.email_confirmed_at is None:
        visitor.email_confirmed_at = now  # Google already verified this address
    try:
        session.commit()
    except IntegrityError as exc:  # concurrent first sign-in of the same address
        session.rollback()
        raise Conflict("email_taken") from exc
    return _issue(settings, visitor, security.new_csrf_token(), now)


def authenticate(
    session: Session, settings: Settings, token: str | None, *, method: str, csrf_header: str | None
) -> VisitorSession:
    """Validates the cookie (and CSRF on unsafe methods); returns a renewed session."""
    if not token or settings.jwt_secret is None:
        raise NotAuthenticated()
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            _key(settings),
            algorithms=[security.JWT_ALGORITHM],
            audience=AUDIENCE,
            options={"require": ["sub", "exp", "iat", "auth_time", "csrf", "pwv", "sev", "aud"]},
        )
        visitor = repo.visitor_by_id(session, uuid.UUID(claims["sub"]))
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise NotAuthenticated() from exc
    if (
        visitor is None
        or not visitor.is_active
        or claims["pwv"] != security.password_version(visitor.password_changed_at)
        or claims["sev"] != visitor.session_version
    ):
        raise NotAuthenticated()
    if method not in ("GET", "HEAD", "OPTIONS"):
        # Bytes: compare_digest rejects non-ASCII str (the header is client input).
        if not csrf_header or not hmac.compare_digest(csrf_header.encode(), str(claims["csrf"]).encode()):
            raise CsrfFailed()
    return _issue(settings, visitor, str(claims["csrf"]), datetime.fromtimestamp(claims["auth_time"], UTC))


def logout(session: Session, visitor: Visitor) -> None:
    """Revokes every session token of the visitor issued so far (all devices)."""
    visitor.session_version += 1
    session.commit()


def change_password(
    session: Session, settings: Settings, auth: VisitorSession, current_password: str, new_password: str
) -> VisitorSession:
    """Verifies the current password (shares the login failure counter, so a stolen session cannot
    brute-force it), stores the new one and bumps `session_version`: every other session signs out.
    The caller gets a fresh session for this device."""
    now = datetime.now(UTC)
    visitor = repo.visitor_by_id(session, auth.visitor.id, for_update=True)
    if visitor is None:
        raise NotAuthenticated()
    password_ok = security.verify_password(visitor.password_hash, current_password)
    if visitor.locked_until is not None and visitor.locked_until > now:
        session.rollback()
        raise InvalidCredentials()
    if not password_ok:
        visitor.failed_logins += 1
        if visitor.failed_logins >= settings.login_max_attempts:
            visitor.failed_logins = 0
            visitor.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
        session.commit()
        raise InvalidCredentials()
    validate_new_password(new_password)
    if new_password == current_password:
        raise InvalidInput("password_unchanged")
    visitor.password_hash = security.hash_password(new_password)
    visitor.password_changed_at = now
    visitor.failed_logins = 0
    visitor.session_version += 1
    session.commit()
    return _issue(settings, visitor, security.new_csrf_token(), now)
