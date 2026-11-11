"""Password reset and e-mail confirmation of visitors by one-time tokens sent by mail.

* The token is 256 random bits; only its SHA-256 is stored, it is single-use and expires
  (reset: 1 hour, confirmation: 3 days). A new request voids the previous unused tokens.
* The reset request answers the same whether or not the e-mail exists; the mail is sent after
  the response (`enqueue`). Neither tokens nor links are logged.
* Per-IP (and, for the reset request, per-e-mail) sliding-window limits cap all endpoints.
"""

import hashlib
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from sqlalchemy.orm import Session

from app import security
from app.config import Settings
from app.models import Visitor
from app.repositories import cabinet as repo
from app.services import mailer
from app.services.auth import normalize_email, validate_new_password
from app.services.errors import InvalidInput, RateLimited
from app.services.rate_limit import RateLimiter

RESET = "password_reset"
CONFIRM = "email_confirm"
LIFETIME = {RESET: timedelta(hours=1), CONFIRM: timedelta(days=3)}
REQUEST_PER_MINUTE = 5
CONFIRM_PER_MINUTE = 10
RESEND_PER_MINUTE = 3
EMAIL_REQUESTS_PER_MINUTE = 2

limiter = RateLimiter()

# (subject, intro, hint) per language and purpose.
_TEXTS = {
    RESET: {
        "ru": ("Сброс пароля — Госархив ВКО", "Чтобы задать новый пароль, откройте ссылку (действует 1 час):",
               "Если вы не запрашивали сброс, просто проигнорируйте письмо."),
        "kk": ("Құпиясөзді қалпына келтіру — ШҚО мемлекеттік архиві", "Жаңа құпиясөз орнату үшін сілтемені ашыңыз (1 сағат жарамды):",
               "Егер сіз сұрамаған болсаңыз, хатты елемей-ақ қойыңыз."),
        "en": ("Password reset — VKO State Archive", "To set a new password open the link (valid for 1 hour):",
               "If you did not request this, just ignore the message."),
    },
    CONFIRM: {
        "ru": ("Подтверждение e-mail — Госархив ВКО", "Чтобы подтвердить e-mail, откройте ссылку:",
               "Если вы не регистрировались, просто проигнорируйте письмо."),
        "kk": ("E-mail растау — ШҚО мемлекеттік архиві", "E-mail мекенжайын растау үшін сілтемені ашыңыз:",
               "Егер сіз тіркелмеген болсаңыз, хатты елемей-ақ қойыңыз."),
        "en": ("E-mail confirmation — VKO State Archive", "To confirm your e-mail open the link:",
               "If you did not register, just ignore the message."),
    },
}
_PAGES = {RESET: "reset-password", CONFIRM: "confirm-email"}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _check_limit(key: str, limit: int) -> None:
    wait = limiter.hit(key, limit)
    if wait is not None:
        raise RateLimited(wait)


def _issue_mail(
    session: Session, settings: Settings, visitor: Visitor, purpose: str, lang: str, enqueue: Callable[..., None]
) -> None:
    """Stores a fresh token (voiding older ones) and queues the mail with the link."""
    now = datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    repo.void_tokens(session, visitor.id, purpose, now)
    repo.add_token(session, visitor.id, purpose, _hash(token), now + LIFETIME[purpose])
    session.commit()
    subject, intro, hint = _TEXTS[purpose][lang]
    link = f"{settings.frontend_url.rstrip('/')}/{lang}/cabinet/{_PAGES[purpose]}?token={quote(token)}"
    enqueue(mailer.send_mail, settings, visitor.email, subject, f"{intro}\n\n{link}\n\n{hint}\n")


def send_confirmation(
    session: Session, settings: Settings, visitor: Visitor, lang: str, enqueue: Callable[..., None]
) -> None:
    if visitor.email_confirmed_at is None:
        _issue_mail(session, settings, visitor, CONFIRM, lang, enqueue)


def request_password_reset(
    session: Session, settings: Settings, email: str, lang: str, *, ip: str | None, enqueue: Callable[..., None]
) -> None:
    """Always returns normally for a well-formed request: callers answer 202 either way."""
    _check_limit(f"reset-request:{ip}", REQUEST_PER_MINUTE)
    email = normalize_email(email)
    # Over the per-e-mail cap the request is dropped silently (no mail flood to a victim).
    if limiter.hit(f"reset-email:{email}", EMAIL_REQUESTS_PER_MINUTE) is not None:
        return
    visitor = repo.visitor_by_email(session, email)
    if visitor is not None and visitor.is_active:
        _issue_mail(session, settings, visitor, RESET, lang, enqueue)


def _consume(session: Session, purpose: str, token: str) -> Visitor:
    """Marks the token used and returns its visitor; one error for unknown, used and expired."""
    now = datetime.now(UTC)
    row = repo.token_by_hash(session, purpose, _hash(token))
    visitor = repo.visitor_by_id(session, row.visitor_id, for_update=True) if row else None
    if row is None or visitor is None or row.used_at is not None or row.expires_at <= now or not visitor.is_active:
        session.rollback()
        raise InvalidInput("invalid_token")
    row.used_at = now
    return visitor


def confirm_password_reset(session: Session, token: str, new_password: str, *, ip: str | None) -> None:
    _check_limit(f"reset-confirm:{ip}", CONFIRM_PER_MINUTE)
    validate_new_password(new_password)
    now = datetime.now(UTC)
    visitor = _consume(session, RESET, token)
    visitor.password_hash = security.hash_password(new_password)
    visitor.password_changed_at = now
    visitor.failed_logins = 0
    visitor.locked_until = None
    visitor.session_version += 1
    if visitor.email_confirmed_at is None:  # the mail reached the owner
        visitor.email_confirmed_at = now
    repo.void_tokens(session, visitor.id, RESET, now)
    session.commit()


def confirm_email(session: Session, token: str, *, ip: str | None) -> None:
    _check_limit(f"email-confirm:{ip}", CONFIRM_PER_MINUTE)
    visitor = _consume(session, CONFIRM, token)
    if visitor.email_confirmed_at is None:
        visitor.email_confirmed_at = datetime.now(UTC)
    session.commit()


def resend_confirmation(
    session: Session, settings: Settings, visitor: Visitor, lang: str, enqueue: Callable[..., None]
) -> None:
    _check_limit(f"email-resend:{visitor.id}", RESEND_PER_MINUTE)
    send_confirmation(session, settings, visitor, lang, enqueue)
