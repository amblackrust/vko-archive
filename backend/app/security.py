"""Password hashing (argon2id) and admin session tokens (HS256 JWT in an httpOnly cookie).

The token carries a CSRF value (`csrf`) that the client must echo in the X-CSRF-Token
header on unsafe requests, and a password version (`pwv`) so that changing the password
invalidates every other session. Inactivity timeout = token `exp`, renewed on each request;
`auth_time` caps the total session length.
"""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.config import Settings

SESSION_COOKIE = "vko_session"
CSRF_COOKIE = "vko_csrf"
CSRF_HEADER = "X-CSRF-Token"
JWT_ALGORITHM = "HS256"

PASSWORD_MIN_LENGTH = 10
# argon2 cost grows with input length; a cap keeps login from being a DoS vector.
PASSWORD_MAX_LENGTH = 256

_hasher = PasswordHasher()
# Verified against when the e-mail is unknown, so response time does not reveal accounts.
_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Constant-work check; an unknown user (hash None) still costs one argon2 verify."""
    try:
        matched = _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return matched and password_hash is not None


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def password_version(changed_at: datetime | None) -> int:
    return int(changed_at.timestamp() * 1_000_000) if changed_at else 0


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _key(settings: Settings) -> str:
    if settings.jwt_secret is None:
        raise RuntimeError("JWT_SECRET is not configured")
    return settings.jwt_secret.get_secret_value()


def create_session_token(
    settings: Settings,
    *,
    user_id: str,
    csrf: str,
    pwv: int,
    auth_time: datetime | None = None,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(UTC)
    auth_time = auth_time or now
    expires = min(
        now + timedelta(minutes=settings.session_idle_minutes),
        auth_time + timedelta(hours=settings.session_max_hours),
    )
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "auth_time": int(auth_time.timestamp()),
        "csrf": csrf,
        "pwv": pwv,
    }
    return jwt.encode(payload, _key(settings), algorithm=JWT_ALGORITHM)


def decode_session_token(settings: Settings, token: str) -> dict[str, Any] | None:
    """Claims of a valid, unexpired token, or None."""
    try:
        return jwt.decode(
            token,
            _key(settings),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat", "auth_time", "csrf", "pwv"]},
        )
    except jwt.InvalidTokenError:
        return None
