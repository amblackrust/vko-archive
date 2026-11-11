from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from starlette.requests import Request

from app import main, security
from app.config import get_settings
from app.deps import BACKGROUND_HEADER, get_optional_user
from app.models import AuditLog, User
from app.models.enums import RoleCode
from tests.admin.conftest import PASSWORD, login


def _set_cookie_headers(response) -> list[str]:
    return response.headers.get_list("set-cookie")


def test_login_sets_secure_httponly_cookie_and_me_works(api, factory):
    user = factory.user(RoleCode.EDITOR)
    response = api.post("/api/admin/auth/login", json={"email": user.email.upper(), "password": PASSWORD})
    assert response.status_code == 200
    session_cookie = next(c for c in _set_cookie_headers(response) if c.startswith(f"{security.SESSION_COOKIE}="))
    lowered = session_cookie.lower()
    assert "httponly" in lowered and "secure" in lowered and "samesite=strict" in lowered
    body = response.json()
    assert body["roles"] == ["editor"] and "content.edit" in body["permissions"]
    assert api.cookies.get(security.CSRF_COOKIE) == body["csrf_token"]

    me = api.get("/api/admin/auth/me")
    assert me.status_code == 200 and me.json()["email"] == user.email


def test_unauthenticated_admin_endpoints_return_401(api):
    for path in ("/api/admin/auth/me", "/api/admin/roles", "/api/admin/audit", "/api/admin/notifications"):
        assert api.get(path).status_code == 401
    api.cookies.set(security.SESSION_COOKIE, "not-a-jwt")
    assert api.get("/api/admin/auth/me").status_code == 401


def test_wrong_password_and_unknown_email_are_indistinguishable(api, factory):
    user = factory.user(RoleCode.EDITOR)
    wrong = api.post("/api/admin/auth/login", json={"email": user.email, "password": "nope-nope-nope"})
    unknown = api.post("/api/admin/auth/login", json={"email": "ghost@test.demo", "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "invalid_credentials"}


def test_inactive_user_cannot_login(api, factory):
    user = factory.user(RoleCode.EDITOR)
    user.is_active = False
    factory.session.commit()
    response = api.post("/api/admin/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 401


def test_lockout_after_five_failures_is_indistinguishable(api, factory):
    user = factory.user(RoleCode.EDITOR)
    unknown = {"email": "ghost@test.demo", "password": "bad-password"}
    for _ in range(5):
        response = api.post("/api/admin/auth/login", json={"email": user.email, "password": "bad-password"})
        assert response.status_code == 401 and "Retry-After" not in response.headers
    factory.session.refresh(user)
    assert user.locked_until is not None

    # Locked: even the right password gets the same answer as an unknown e-mail.
    locked = api.post("/api/admin/auth/login", json={"email": user.email, "password": PASSWORD})
    ghost = api.post("/api/admin/auth/login", json=unknown)
    assert locked.status_code == ghost.status_code == 401
    assert locked.json() == ghost.json() == {"detail": "invalid_credentials"}

    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    factory.session.commit()
    login(api, user.email)


def test_unknown_email_is_not_journaled_as_actor(api, factory):
    typed = f"ghost-{datetime.now(UTC).timestamp()}@test.demo"
    api.post("/api/admin/auth/login", json={"email": typed, "password": "bad-password"})
    leaked = factory.session.execute(
        text("SELECT count(*) FROM audit_logs WHERE coalesce(actor, '') LIKE :p OR details::text LIKE :p"),
        {"p": f"%{typed}%"},
    ).scalar()
    assert leaked == 0


def test_password_change_shares_lockout(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    body = {"current_password": "bad-password", "new_password": "Another-Pass-42"}
    for _ in range(4):
        assert api.post("/api/admin/auth/password", json=body).status_code == 401
    fifth = api.post("/api/admin/auth/password", json=body)
    assert fifth.status_code == 429 and fifth.json() == {"detail": "account_locked"}
    assert 15 * 60 <= int(fifth.headers["Retry-After"]) <= 15 * 60 + 1
    right = api.post("/api/admin/auth/password", json={**body, "current_password": PASSWORD})
    assert right.status_code == 429
    api.cookies.clear()
    assert api.post("/api/admin/auth/login", json={"email": user.email, "password": PASSWORD}).status_code == 401


def test_csrf_required_on_unsafe_requests(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    csrf = api.headers.pop(security.CSRF_HEADER)
    assert api.post("/api/admin/notifications/read-all").json() == {"detail": "csrf_failed"}
    api.headers[security.CSRF_HEADER] = "forged"
    assert api.post("/api/admin/notifications/read-all").status_code == 403
    # Non-ASCII header value: rejected, not a 500 (hmac.compare_digest on str would raise).
    non_ascii = api.post("/api/admin/notifications/read-all", headers={security.CSRF_HEADER: "токен".encode()})
    assert non_ascii.json() == {"detail": "csrf_failed"}
    api.headers[security.CSRF_HEADER] = csrf
    assert api.post("/api/admin/notifications/read-all").status_code == 204


def test_inactivity_timeout_and_max_session(api, factory):
    settings = get_settings()
    user = factory.user(RoleCode.EDITOR)
    long_ago = datetime.now(UTC) - timedelta(minutes=31)
    stale = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0, sev=0, now=long_ago)
    assert security.decode_session_token(settings, stale) is None

    fresh = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0, sev=0)
    assert security.decode_session_token(settings, fresh)["sub"] == str(user.id)

    # Renewal never extends a session past session_max_hours since login.
    old_login = datetime.now(UTC) - timedelta(hours=settings.session_max_hours, seconds=1)
    capped = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0, sev=0, auth_time=old_login)
    assert security.decode_session_token(settings, capped) is None


def test_session_renewal_and_logout(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    me = api.get("/api/admin/auth/me")
    assert any(c.startswith(f"{security.SESSION_COOKIE}=") for c in _set_cookie_headers(me))  # sliding renewal
    # Background polling authenticates but does not extend the inactivity timeout.
    assert not _set_cookie_headers(api.get("/api/admin/notifications"))
    background = api.get("/api/admin/auth/me", headers={BACKGROUND_HEADER: "1"})
    assert background.status_code == 200 and not _set_cookie_headers(background)
    assert api.post("/api/admin/auth/logout").status_code == 204
    assert api.get("/api/admin/auth/me").status_code == 401


def test_password_change_invalidates_other_sessions(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    old_token = api.cookies.get(security.SESSION_COOKIE)

    wrong = api.post("/api/admin/auth/password", json={"current_password": "bad", "new_password": "Another-Pass-42"})
    assert wrong.status_code == 401
    weak = api.post("/api/admin/auth/password", json={"current_password": PASSWORD, "new_password": "short"})
    assert weak.status_code == 422 and weak.json() == {"detail": "password_length"}

    ok = api.post("/api/admin/auth/password", json={"current_password": PASSWORD, "new_password": "Another-Pass-42"})
    assert ok.status_code == 200
    assert api.get("/api/admin/auth/me").status_code == 200  # this session got a new token

    api.cookies.clear()
    api.cookies.set(security.SESSION_COOKIE, old_token)
    assert api.get("/api/admin/auth/me").status_code == 401  # the old token is dead
    api.cookies.clear()
    login(api, user.email, "Another-Pass-42")


def test_login_attempts_are_journaled_without_secrets(api, factory):
    secret_wrong = "Wrong-Secret-Value-9137"
    secret_new = "New-Secret-Value-5521"
    user = factory.user(RoleCode.EDITOR)
    api.post("/api/admin/auth/login", json={"email": user.email, "password": secret_wrong})
    login(api, user.email)
    api.post("/api/admin/auth/password", json={"current_password": PASSWORD, "new_password": secret_new})

    s = factory.session
    s.expire_all()
    rows = s.scalars(select(AuditLog).where(AuditLog.actor == user.email).order_by(AuditLog.id)).all()
    results = [(r.action_type, r.result.value) for r in rows]
    assert ("auth.login", "failure") in results
    assert ("auth.login", "success") in results
    assert ("auth.password_change", "success") in results
    csrf = api.cookies.get(security.CSRF_COOKIE)
    token = api.cookies.get(security.SESSION_COOKIE)
    password_hash = s.get(User, user.id).password_hash
    for needle in (secret_wrong, secret_new, PASSWORD, csrf, token, password_hash):
        leaked = s.execute(
            text("SELECT count(*) FROM audit_logs WHERE details::text LIKE :p OR coalesce(actor, '') LIKE :p"),
            {"p": f"%{needle}%"},
        ).scalar()
        assert leaked == 0


def _request(method: str, token: str, csrf: str | None = None) -> Request:
    headers = [(b"cookie", f"{security.SESSION_COOKIE}={token}".encode())]
    if csrf is not None:
        headers.append((security.CSRF_HEADER.lower().encode(), csrf.encode()))
    return Request({"type": "http", "method": method, "headers": headers, "query_string": b""})


def test_optional_user_checks_csrf_on_unsafe_methods(factory):
    settings = get_settings()
    user = factory.user(RoleCode.EDITOR)
    token = security.create_session_token(settings, user_id=str(user.id), csrf="c" * 20, pwv=0, sev=0)
    s = factory.session
    assert get_optional_user(_request("GET", token), s, settings).id == user.id
    assert get_optional_user(_request("POST", token), s, settings) is None
    assert get_optional_user(_request("POST", token, "forged"), s, settings) is None
    assert get_optional_user(_request("POST", token, "c" * 20), s, settings).id == user.id
    # No JWT_SECRET (development): anonymous instead of a 500.
    assert get_optional_user(_request("GET", token), s, settings.model_copy(update={"jwt_secret": None})) is None


def test_app_refuses_to_start_without_secret_outside_development(monkeypatch):
    settings = get_settings().model_copy(update={"app_env": "production", "jwt_secret": None})
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        main.create_app()
