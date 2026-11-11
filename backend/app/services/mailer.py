"""Outgoing mail over SMTP (STARTTLS). Without `SMTP_HOST` nothing is sent. A failed send is
logged by exception type only: message bodies carry one-time links and must never reach the logs."""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import Settings

logger = logging.getLogger(__name__)


def is_configured(settings: Settings) -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def send_mail(settings: Settings, to: str, subject: str, body: str) -> bool:
    """Sends a plain-text message; True if it was handed to the SMTP server."""
    if not is_configured(settings):
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_user and settings.smtp_password is not None:
                smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.warning("mail delivery failed: %s", type(exc).__name__)
        return False
    return True
