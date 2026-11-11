"""Password reset and e-mail confirmation of visitors (mailer replaced, links captured)."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Visitor, VisitorToken
from app.security import CSRF_HEADER
from app.services import mailer, visitor_tokens
from tests.cabinet.conftest import PASSWORD, new_email, register

AUTH = "/api/cabinet/auth"
NEW_PASSWORD = "Another-Pass-2-Value"


@pytest.fixture(autouse=True)
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    visitor_tokens.limiter.reset()
    sent: list[tuple[str, str, str]] = []

    def fake_send(settings: object, to: str, subject: str, body: str) -> bool:
        sent.append((to, subject, body))
        return True

    monkeypatch.setattr(mailer, "send_mail", fake_send)
    return sent


def _token(mail: tuple[str, str, str]) -> str:
    match = re.search(r"token=([\w-]+)", mail[2])
    assert match
    return match.group(1)


def test_register_sends_confirmation_and_confirm_marks_email(api: TestClient, second_client: TestClient, outbox) -> None:
    email = new_email()
    me = register(api, email)
    assert me["email_confirmed"] is False
    assert len(outbox) == 1 and outbox[0][0] == email
    assert "/ru/cabinet/confirm-email?token=" in outbox[0][2]
    token = _token(outbox[0])
    assert second_client.post(f"{AUTH}/email/confirm", json={"token": token}).status_code == 204
    assert api.get("/api/cabinet/me").json()["email_confirmed"] is True
    # single use
    assert second_client.post(f"{AUTH}/email/confirm", json={"token": token}).json() == {"detail": "invalid_token"}


def test_unconfirmed_visitor_can_log_in(api: TestClient, second_client: TestClient) -> None:
    email = new_email()
    register(api, email)
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_tokens_are_stored_only_as_hash(api: TestClient, engine, outbox) -> None:
    register(api)
    token = _token(outbox[0])
    with Session(engine) as session:
        rows = session.query(VisitorToken).all()
        assert token not in {row.token_hash for row in rows}
        assert any(row.token_hash == visitor_tokens._hash(token) for row in rows)


def test_resend_requires_session_and_voids_previous_token(api: TestClient, second_client: TestClient, outbox) -> None:
    assert second_client.post(f"{AUTH}/email/resend", json={}).status_code == 401
    register(api)
    old = _token(outbox[0])
    assert api.post(f"{AUTH}/email/resend", json={"lang": "en"}).status_code == 202
    assert len(outbox) == 2 and "/en/cabinet/confirm-email" in outbox[1][2]
    assert second_client.post(f"{AUTH}/email/confirm", json={"token": old}).status_code == 422
    assert second_client.post(f"{AUTH}/email/confirm", json={"token": _token(outbox[1])}).status_code == 204
    assert api.post(f"{AUTH}/email/resend", json={}).status_code == 202
    assert len(outbox) == 2  # already confirmed: nothing sent


def test_reset_request_answers_the_same_for_unknown_email(api: TestClient, second_client: TestClient, outbox) -> None:
    email = new_email()
    register(api, email)
    outbox.clear()
    known = second_client.post(f"{AUTH}/password-reset/request", json={"email": email.upper()})
    unknown = second_client.post(f"{AUTH}/password-reset/request", json={"email": new_email()})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox) == 1 and outbox[0][0] == email and "/ru/cabinet/reset-password?token=" in outbox[0][2]


def test_reset_confirm_sets_password_revokes_sessions_and_is_single_use(
    api: TestClient, second_client: TestClient, outbox
) -> None:
    email = new_email()
    register(api, email)
    outbox.clear()
    second_client.post(f"{AUTH}/password-reset/request", json={"email": email})
    token = _token(outbox[0])
    assert second_client.post(f"{AUTH}/password-reset/confirm", json={"token": token, "new_password": "short"}).status_code == 422
    done = second_client.post(f"{AUTH}/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD})
    assert done.status_code == 204
    assert api.get("/api/cabinet/me").status_code == 401  # old session revoked
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD}).status_code == 401
    login = second_client.post(f"{AUTH}/login", json={"email": email, "password": NEW_PASSWORD})
    assert login.status_code == 200 and login.json()["email_confirmed"] is True
    again = second_client.post(f"{AUTH}/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD + "x"})
    assert again.json() == {"detail": "invalid_token"}


def test_reset_token_expires_and_garbage_is_rejected(api: TestClient, second_client: TestClient, engine, outbox) -> None:
    email = new_email()
    register(api, email)
    outbox.clear()
    second_client.post(f"{AUTH}/password-reset/request", json={"email": email})
    with Session(engine) as session:
        session.execute(update(VisitorToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
        session.commit()
    body = {"token": _token(outbox[0]), "new_password": NEW_PASSWORD}
    assert second_client.post(f"{AUTH}/password-reset/confirm", json=body).status_code == 422
    assert second_client.post(f"{AUTH}/password-reset/confirm", json={**body, "token": "nope"}).status_code == 422


def test_new_reset_request_voids_the_previous_token(api: TestClient, second_client: TestClient, outbox) -> None:
    email = new_email()
    register(api, email)
    outbox.clear()
    second_client.post(f"{AUTH}/password-reset/request", json={"email": email})
    visitor_tokens.limiter.reset()
    second_client.post(f"{AUTH}/password-reset/request", json={"email": email})
    old, new = _token(outbox[0]), _token(outbox[1])
    assert second_client.post(f"{AUTH}/password-reset/confirm", json={"token": old, "new_password": NEW_PASSWORD}).status_code == 422
    assert second_client.post(f"{AUTH}/password-reset/confirm", json={"token": new, "new_password": NEW_PASSWORD}).status_code == 204


def test_reset_request_is_rate_limited_per_ip_and_per_email(api: TestClient, outbox) -> None:
    email = new_email()
    register(api, email)
    outbox.clear()
    for _ in range(4):
        assert api.post(f"{AUTH}/password-reset/request", json={"email": email}).status_code == 202
    assert len(outbox) == 2  # per-e-mail cap drops the rest silently
    assert api.post(f"{AUTH}/password-reset/request", json={"email": new_email()}).status_code == 202
    limited = api.post(f"{AUTH}/password-reset/request", json={"email": new_email()})
    assert limited.status_code == 429 and limited.headers["Retry-After"]


def test_unconfigured_smtp_does_not_fail(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    monkeypatch.undo()
    from app.config import Settings

    settings = Settings(database_url="postgresql+psycopg://x/y", smtp_host="")
    assert mailer.send_mail(settings, "a@b.c", "s", "https://x/?token=secret") is False
    assert "secret" not in caplog.text
