"""Visitor registration / login / sessions (T5.18): separate from staff, argon2, CSRF, lockout."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Visitor
from app.models.enums import RoleCode
from app.security import CSRF_HEADER
from tests.admin.conftest import login as staff_login
from tests.cabinet.conftest import PASSWORD, new_email, register

AUTH = "/api/cabinet/auth"


def test_register_sets_httponly_session_and_stores_argon2_hash(api: TestClient, engine) -> None:
    email = new_email()
    response = api.post(f"{AUTH}/register", json={"email": f" {email.upper()} ", "password": PASSWORD, "display_name": "ДЕМО Гость"})
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email and "password" not in response.text and "hash" not in response.text
    cookies = response.headers.get_list("set-cookie")
    session_cookie = next(c for c in cookies if c.startswith("vko_visitor="))
    assert "HttpOnly" in session_cookie and "Secure" in session_cookie and "SameSite=strict" in session_cookie
    with Session(engine) as session:
        visitor = session.query(Visitor).filter(Visitor.email == email).one()
        assert visitor.password_hash.startswith("$argon2id$") and PASSWORD not in visitor.password_hash
    assert api.get("/api/cabinet/me").json()["email"] == email


def test_register_rejects_duplicate_weak_password_and_bad_email(api: TestClient) -> None:
    email = new_email()
    register(api, email)
    assert api.post(f"{AUTH}/register", json={"email": email.upper(), "password": PASSWORD}).status_code == 409
    assert api.post(f"{AUTH}/register", json={"email": new_email(), "password": "short"}).status_code == 422
    assert api.post(f"{AUTH}/register", json={"email": new_email(), "password": "aaaaaaaaaaaa"}).status_code == 422
    assert api.post(f"{AUTH}/register", json={"email": "not-an-email", "password": PASSWORD}).status_code == 422


def test_register_is_rate_limited(api: TestClient) -> None:
    codes = [api.post(f"{AUTH}/register", json={"email": "bad", "password": PASSWORD}).status_code for _ in range(7)]
    assert codes[:5] == [422] * 5 and codes[5] == 429
    assert api.post(f"{AUTH}/register", json={"email": "bad", "password": PASSWORD}).headers["Retry-After"]


def test_login_logout_and_generic_errors(api: TestClient, second_client: TestClient) -> None:
    email = new_email()
    register(api, email)
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": "Wrong-Password-9"}).status_code == 401
    assert second_client.post(f"{AUTH}/login", json={"email": new_email(), "password": PASSWORD}).json() == {"detail": "invalid_credentials"}
    ok = second_client.post(f"{AUTH}/login", json={"email": email.upper(), "password": PASSWORD})
    assert ok.status_code == 200
    second_client.headers[CSRF_HEADER] = ok.json()["csrf_token"]
    assert second_client.post(f"{AUTH}/logout").status_code == 204
    assert second_client.get("/api/cabinet/me").status_code == 401


def test_lockout_after_failed_attempts_hides_the_reason(api: TestClient, second_client: TestClient) -> None:
    email = new_email()
    register(api, email)
    for _ in range(5):
        assert second_client.post(f"{AUTH}/login", json={"email": email, "password": "Wrong-Password-9"}).status_code == 401
    locked = second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    assert locked.status_code == 401 and locked.json() == {"detail": "invalid_credentials"}


def test_csrf_required_on_unsafe_methods(api: TestClient) -> None:
    register(api)
    token = api.headers.pop(CSRF_HEADER)
    assert api.put("/api/cabinet/subscriptions/news").status_code == 403
    assert api.put("/api/cabinet/subscriptions/news", headers={CSRF_HEADER: "wrong"}).status_code == 403
    assert api.put("/api/cabinet/subscriptions/news", headers={CSRF_HEADER: token}).status_code == 200
    assert api.get("/api/cabinet/me").status_code == 200  # safe methods need no token


def test_visitor_has_no_staff_rights(api: TestClient) -> None:
    register(api)
    for path in ("/api/admin/auth/me", "/api/admin/roles", "/api/admin/audit", "/api/admin/notifications"):
        assert api.get(path).status_code == 401, path
    # A visitor token is not accepted as the staff cookie either.
    api.cookies.set("vko_session", api.cookies["vko_visitor"])
    assert api.get("/api/admin/auth/me").status_code == 401


def test_staff_session_is_not_a_visitor_session(api: TestClient, factory) -> None:
    staff = factory.user(RoleCode.SUPER_ADMIN)
    staff_login(api, staff.email)
    assert api.get("/api/cabinet/me").status_code == 401
    api.cookies.set("vko_visitor", api.cookies["vko_session"])
    assert api.get("/api/cabinet/me").status_code == 401


def test_delete_account_removes_data_and_session(api: TestClient, engine) -> None:
    body = register(api)
    api.put("/api/cabinet/subscriptions/news")
    assert api.delete("/api/cabinet/me").status_code == 204
    with Session(engine) as session:
        assert session.get(Visitor, body["id"]) is None
    assert api.get("/api/cabinet/me").status_code == 401


def test_logout_revokes_the_token_on_the_server(api: TestClient) -> None:
    register(api)
    stolen = api.cookies.get("vko_visitor")
    assert api.post(f"{AUTH}/logout").status_code == 204
    api.cookies.clear()
    api.cookies.set("vko_visitor", stolen)
    assert api.get("/api/cabinet/me").status_code == 401


def test_change_password_signs_out_other_sessions_and_keeps_this_one(api: TestClient, second_client: TestClient) -> None:
    email = new_email()
    register(api, email)
    second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    new_password = "Another-Cabinet-Pass-2"
    response = api.post(f"{AUTH}/password", json={"current_password": PASSWORD, "new_password": new_password})
    assert response.status_code == 200
    api.headers[CSRF_HEADER] = response.json()["csrf_token"]
    assert api.get("/api/cabinet/me").status_code == 200
    assert second_client.get("/api/cabinet/me").status_code == 401
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD}).status_code == 401
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": new_password}).status_code == 200


def test_change_password_validates_current_new_and_csrf(api: TestClient) -> None:
    register(api)
    url = f"{AUTH}/password"
    assert api.post(url, json={"current_password": "wrong-password-1", "new_password": "Another-Cabinet-Pass-2"}).status_code == 401
    assert api.post(url, json={"current_password": PASSWORD, "new_password": "short"}).status_code == 422
    assert api.post(url, json={"current_password": PASSWORD, "new_password": PASSWORD}).status_code == 422
    token = api.headers.pop(CSRF_HEADER)
    assert api.post(url, json={"current_password": PASSWORD, "new_password": "Another-Cabinet-Pass-2"}).status_code == 403
    api.headers[CSRF_HEADER] = token


def test_change_password_wrong_current_locks_account_after_limit(api: TestClient, second_client: TestClient) -> None:
    email = new_email()
    register(api, email)
    codes = [
        api.post(f"{AUTH}/password", json={"current_password": "wrong-password-1", "new_password": "Another-Cabinet-Pass-2"}).status_code
        for _ in range(7)
    ]
    assert set(codes) == {401}
    assert second_client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD}).status_code == 401
