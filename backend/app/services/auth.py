"""Staff login, sessions and password change (T6.1).

Lockout: `login_max_attempts` wrong passwords in a row lock the account for
`login_lock_minutes`. Every attempt (success or failure) is journaled; the password
itself never is.
"""

import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app import security
from app.config import Settings
from app.models import User
from app.models.enums import AuditResult
from app.repositories import users as users_repo
from app.services import audit
from app.services.authz import AuthUser, load_auth_user
from app.services.errors import AccountLocked, CsrfFailed, InvalidCredentials, InvalidInput, NotAuthenticated


@dataclass(frozen=True)
class AuthSession:
    user: AuthUser
    csrf: str
    token: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _issue(settings: Settings, user: User, auth_user: AuthUser, csrf: str, auth_time: datetime | None = None) -> AuthSession:
    token = security.create_session_token(
        settings,
        user_id=str(user.id),
        csrf=csrf,
        pwv=security.password_version(user.password_changed_at),
        auth_time=auth_time,
    )
    return AuthSession(user=auth_user, csrf=csrf, token=token)


def login(session: Session, settings: Settings, email: str, password: str, *, ip: str | None) -> AuthSession:
    email = normalize_email(email)
    now = datetime.now(UTC)
    user = users_repo.get_by_email(session, email, for_update=True)

    def fail(reason: str, user_id: uuid.UUID | None = None) -> None:
        audit.record(
            session,
            action_type="auth.login",
            result=AuditResult.FAILURE,
            actor=email,
            object_type="user" if user_id else None,
            object_id=user_id,
            details={"reason": reason},
            ip=ip,
        )
        session.commit()

    if user is None:
        security.verify_password(None, password)  # same cost as a real check
        fail("unknown_user")
        raise InvalidCredentials()
    if user.locked_until is not None and user.locked_until > now:
        fail("locked", user.id)
        raise AccountLocked(int((user.locked_until - now).total_seconds()) + 1)
    if not security.verify_password(user.password_hash, password):
        user.failed_logins += 1
        if user.failed_logins >= settings.login_max_attempts:
            user.failed_logins = 0
            user.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
            fail("wrong_password_locked", user.id)
            raise AccountLocked(settings.login_lock_minutes * 60)
        fail("wrong_password", user.id)
        raise InvalidCredentials()
    if not user.is_active:
        fail("inactive", user.id)
        raise InvalidCredentials()

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    if security.password_needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(password)
    auth_user = load_auth_user(session, user)
    audit.record(
        session, action_type="auth.login", result=AuditResult.SUCCESS, user=auth_user,
        object_type="user", object_id=user.id, ip=ip,
    )
    session.commit()
    return _issue(settings, user, auth_user, security.new_csrf_token(), auth_time=now)


def authenticate(
    session: Session, settings: Settings, token: str | None, *, method: str, csrf_header: str | None
) -> AuthSession:
    """Validates the session cookie (and the CSRF header on unsafe methods) and returns
    a renewed session: its token restarts the inactivity timer."""
    claims: dict[str, Any] | None = security.decode_session_token(settings, token) if token else None
    if claims is None:
        raise NotAuthenticated()
    try:
        user_id = uuid.UUID(claims["sub"])
    except (ValueError, TypeError) as exc:
        raise NotAuthenticated() from exc
    user = users_repo.get_by_id(session, user_id)
    if (
        user is None
        or not user.is_active
        or claims["pwv"] != security.password_version(user.password_changed_at)
    ):
        raise NotAuthenticated()
    if method not in ("GET", "HEAD", "OPTIONS"):
        if not csrf_header or not hmac.compare_digest(csrf_header, str(claims["csrf"])):
            raise CsrfFailed()
    auth_time = datetime.fromtimestamp(claims["auth_time"], UTC)
    return _issue(settings, user, load_auth_user(session, user), str(claims["csrf"]), auth_time=auth_time)


def logout(session: Session, user: AuthUser, *, ip: str | None) -> None:
    audit.record(session, action_type="auth.logout", result=AuditResult.SUCCESS, user=user, ip=ip)
    session.commit()


def validate_new_password(password: str) -> None:
    if not security.PASSWORD_MIN_LENGTH <= len(password) <= security.PASSWORD_MAX_LENGTH:
        raise InvalidInput("password_length")
    if password.strip() != password or len(set(password)) < 4:
        raise InvalidInput("password_too_weak")


def change_password(
    session: Session, settings: Settings, auth: AuthSession, current_password: str, new_password: str, *, ip: str | None
) -> AuthSession:
    """Other sessions of the user become invalid (their `pwv` no longer matches)."""
    user = users_repo.get_by_id(session, auth.user.id)
    if user is None:
        raise NotAuthenticated()
    if not security.verify_password(user.password_hash, current_password):
        audit.record(
            session, action_type="auth.password_change", result=AuditResult.FAILURE, user=auth.user,
            object_type="user", object_id=user.id, details={"reason": "wrong_current_password"}, ip=ip,
        )
        session.commit()
        raise InvalidCredentials()
    validate_new_password(new_password)
    if new_password == current_password:
        raise InvalidInput("password_unchanged")
    user.password_hash = security.hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    audit.record(
        session, action_type="auth.password_change", result=AuditResult.SUCCESS, user=auth.user,
        object_type="user", object_id=user.id, ip=ip,
    )
    session.commit()
    return _issue(settings, user, auth.user, auth.csrf)
