from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from app import security
from app.config import get_settings
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


def test_lockout_after_five_failures(api, factory):
    user = factory.user(RoleCode.EDITOR)
    for _ in range(4):
        assert api.post("/api/admin/auth/login", json={"email": user.email, "password": "bad-password"}).status_code == 401
    fifth = api.post("/api/admin/auth/login", json={"email": user.email, "password": "bad-password"})
    assert fifth.status_code == 429 and fifth.json() == {"detail": "account_locked"}
    assert int(fifth.headers["Retry-After"]) == 15 * 60

    # Even the right password is refused while locked.
    locked = api.post("/api/admin/auth/login", json={"email": user.email, "password": PASSWORD})
    assert locked.status_code == 429

    factory.session.refresh(user)
    assert user.locked_until is not None
    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    factory.session.commit()
    login(api, user.email)


def test_csrf_required_on_unsafe_requests(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    csrf = api.headers.pop(security.CSRF_HEADER)
    assert api.post("/api/admin/notifications/read-all").json() == {"detail": "csrf_failed"}
    api.headers[security.CSRF_HEADER] = "forged"
    assert api.post("/api/admin/notifications/read-all").status_code == 403
    api.headers[security.CSRF_HEADER] = csrf
    assert api.post("/api/admin/notifications/read-all").status_code == 204


def test_inactivity_timeout_and_max_session(api, factory):
    settings = get_settings()
    user = factory.user(RoleCode.EDITOR)
    long_ago = datetime.now(UTC) - timedelta(minutes=31)
    stale = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0, now=long_ago)
    assert security.decode_session_token(settings, stale) is None

    fresh = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0)
    assert security.decode_session_token(settings, fresh)["sub"] == str(user.id)

    # Renewal never extends a session past session_max_hours since login.
    old_login = datetime.now(UTC) - timedelta(hours=settings.session_max_hours, seconds=1)
    capped = security.create_session_token(settings, user_id=str(user.id), csrf="x", pwv=0, auth_time=old_login)
    assert security.decode_session_token(settings, capped) is None


def test_session_renewal_and_logout(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    me = api.get("/api/admin/auth/me")
    assert any(c.startswith(f"{security.SESSION_COOKIE}=") for c in _set_cookie_headers(me))  # sliding renewal
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
