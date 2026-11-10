"""Staff login, sessions and password change (T6.1).

Lockout: `login_max_attempts` wrong passwords in a row (at login or as the current
password on /auth/password) lock the account for `login_lock_minutes`. Login answers a
locked, inactive or unknown account exactly like a wrong password (401, same argon2 work),
so the response does not reveal which e-mails exist (docs/DECISIONS.md п.19, п.25).
Every attempt (success or failure) is journaled; the password itself never is.
"""

import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, NoReturn

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


def _register_failure(settings: Settings, user: User, now: datetime) -> bool:
    """Counts a wrong password; True if it has just locked the account."""
    user.failed_logins += 1
    if user.failed_logins < settings.login_max_attempts:
        return False
    user.failed_logins = 0
    user.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
    return True


def _is_locked(user: User, now: datetime) -> bool:
    return user.locked_until is not None and user.locked_until > now


def login(session: Session, settings: Settings, email: str, password: str, *, ip: str | None) -> AuthSession:
    email = normalize_email(email)
    now = datetime.now(UTC)
    user = users_repo.get_by_email(session, email, for_update=True)
    # Always one argon2 verify, whatever the account state: equal timing for every outcome.
    password_ok = security.verify_password(user.password_hash if user else None, password)

    def fail(reason: str) -> NoReturn:
        # The typed e-mail of an unknown account is not stored: it may be a mistyped
        # password or someone else's personal data.
        audit.record(
            session,
            action_type="auth.login",
            result=AuditResult.FAILURE,
            actor=user.email if user else None,
            object_type="user" if user else None,
            object_id=user.id if user else None,
            details={"reason": reason},
            ip=ip,
        )
        session.commit()
        raise InvalidCredentials()

    if user is None:
        fail("unknown_user")
    if _is_locked(user, now):
        fail("locked")
    if not password_ok:
        fail("wrong_password_locked" if _register_failure(settings, user, now) else "wrong_password")
    if not user.is_active:
        fail("inactive")

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
        # Bytes: compare_digest rejects non-ASCII str with TypeError (header is client input).
        if not csrf_header or not hmac.compare_digest(csrf_header.encode(), str(claims["csrf"]).encode()):
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
    now = datetime.now(UTC)
    user = users_repo.get_by_id(session, auth.user.id, for_update=True)
    if user is None:
        raise NotAuthenticated()
    password_ok = security.verify_password(user.password_hash, current_password)
    # Shares the login counter: a stolen session cannot brute-force the current password.
    reason = None
    if _is_locked(user, now):
        reason = "locked"
    elif not password_ok:
        reason = "wrong_current_password_locked" if _register_failure(settings, user, now) else "wrong_current_password"
    if reason is not None:
        audit.record(
            session, action_type="auth.password_change", result=AuditResult.FAILURE, user=auth.user,
            object_type="user", object_id=user.id, details={"reason": reason}, ip=ip,
        )
        session.commit()
        if _is_locked(user, now):
            raise AccountLocked(int((user.locked_until - now).total_seconds()) + 1)
        raise InvalidCredentials()
    validate_new_password(new_password)
    if new_password == current_password:
        raise InvalidInput("password_unchanged")
    user.password_hash = security.hash_password(new_password)
    user.password_changed_at = now
    user.failed_logins = 0
    audit.record(
        session, action_type="auth.password_change", result=AuditResult.SUCCESS, user=auth.user,
        object_type="user", object_id=user.id, ip=ip,
    )
    session.commit()
    return _issue(settings, user, auth.user, auth.csrf)
