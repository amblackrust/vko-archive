"""T7.4 hardening: API headers, CORS, hidden docs, storage, session revocation, append-only
journal, login rate limit, and the workflow guards that keep review from being bypassed."""

import io
import logging
import uuid

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app import main, security
from app.config import Settings, get_settings
from app.logging_config import StructuredFormatter
from app.models import AuditLog, DigitalFile, News
from app.models.enums import AuditResult, DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from app.repositories import roles as roles_repo
from app.services import auth
from tests.admin.conftest import PASSWORD, Factory, login

ADMIN = "/api/admin"
FRONTEND = "http://localhost:3000"


def test_api_responses_carry_security_headers(api):
    response = api.get("/api/health")
    headers = response.headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "no-referrer"
    assert "default-src 'none'" in headers["content-security-policy"]
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert "strict-transport-security" not in headers  # development: no HSTS over http


def test_production_adds_hsts_and_hides_docs(monkeypatch):
    settings = get_settings().model_copy(update={"app_env": "production", "jwt_secret": SecretStr("p" * 40)})
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    with TestClient(main.create_app(), base_url="https://testserver") as client:
        assert client.get("/api/no-such-route").headers["strict-transport-security"].startswith("max-age=")
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404


def test_cors_allows_only_the_own_frontend(api):
    allowed = api.options(
        "/api/admin/auth/login",
        headers={"Origin": FRONTEND, "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "content-type,x-csrf-token"},
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == FRONTEND
    assert allowed.headers["access-control-allow-credentials"] == "true"
    foreign = api.options(
        "/api/admin/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in foreign.headers
    simple = api.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers


@pytest.mark.parametrize("origins", [["*"], ["localhost:3000"]])
def test_wildcard_cors_origin_is_rejected(origins):
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql+psycopg://x@localhost/x", cors_origins=origins)


@pytest.mark.parametrize("path", ["/storage/masters/x.jpg", "/api/storage/masters/x.jpg", "/masters/x.jpg", "/static/x"])
def test_storage_is_not_served_as_static_files(api, path):
    assert api.get(path).status_code == 404
    mounts = [route for route in main.app.routes if type(route).__name__ == "Mount"]
    assert mounts == []


def test_staff_logout_revokes_the_token_on_the_server(api, factory):
    user = factory.user(RoleCode.EDITOR)
    login(api, user.email)
    stolen = api.cookies.get(security.SESSION_COOKIE)
    assert api.post(f"{ADMIN}/auth/logout").status_code == 204
    api.cookies.clear()
    api.cookies.set(security.SESSION_COOKIE, stolen)
    assert api.get(f"{ADMIN}/auth/me").status_code == 401  # a copied cookie is dead too
    api.cookies.clear()
    login(api, user.email)  # a new login works
    assert api.get(f"{ADMIN}/auth/me").status_code == 200


def test_staff_login_is_rate_limited_per_address(api, factory):
    user = factory.user(RoleCode.EDITOR)
    codes = [
        api.post(f"{ADMIN}/auth/login", json={"email": f"nobody-{i}@test.demo", "password": "x" * 12}).status_code
        for i in range(auth.LOGIN_PER_MINUTE)
    ]
    assert set(codes) == {401}
    limited = api.post(f"{ADMIN}/auth/login", json={"email": user.email, "password": PASSWORD})
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) >= 1


def test_audit_log_is_append_only_in_the_database(factory: Factory):
    session = factory.session
    author = factory.user(RoleCode.EDITOR)
    entry = AuditLog(user_id=author.id, action_type="test.append_only", result=AuditResult.SUCCESS, details={})
    session.add(entry)
    session.commit()
    for statement in (
        "UPDATE audit_logs SET action_type = 'forged' WHERE id = :id",
        "UPDATE audit_logs SET user_id = NULL WHERE id = :id",  # only the FK action may do this
        "DELETE FROM audit_logs WHERE id = :id",
        "TRUNCATE audit_logs",
    ):
        with pytest.raises(DBAPIError, match="append-only"):
            session.execute(text(statement), {"id": entry.id})
        session.rollback()
    assert session.scalar(select(AuditLog.action_type).where(AuditLog.id == entry.id)) == "test.append_only"


def test_deleting_a_user_keeps_their_journal_entries(factory: Factory):
    """The only change the trigger allows: FK ON DELETE SET NULL of a deleted user."""
    user = factory.user(RoleCode.EDITOR)
    session = factory.session
    entry = AuditLog(user_id=user.id, actor=user.email, action_type="test.user_gone", result=AuditResult.SUCCESS, details={})
    session.add(entry)
    session.commit()
    session.delete(user)
    session.commit()
    session.refresh(entry)
    assert entry.user_id is None and entry.actor == user.email


# --- review cannot be bypassed --------------------------------------------------------------

def _publisher(factory: Factory):
    user = factory.user(RoleCode.EDITOR)
    user.roles.append(roles_repo.get_role(factory.session, RoleCode.MODERATOR.value))
    factory.session.commit()
    return user


def _news(factory: Factory, status: WorkflowStatus, **values) -> News:
    return factory.add(News(slug=f"n-{uuid.uuid4().hex[:8]}", title={"ru": "ДЕМО новость"}, workflow_status=status,
                            is_demo=True, **values))


@pytest.mark.parametrize("status", [WorkflowStatus.PUBLISHED, WorkflowStatus.APPROVED])
def test_live_object_is_changed_only_with_publishing_rights(api, factory, status):
    news = _news(factory, status)
    login(api, factory.user(RoleCode.EDITOR).email)
    change = {"version": 1, "title": {"ru": "Правка без согласования"}}
    assert api.patch(f"{ADMIN}/content/news/{news.id}", json=change).status_code == 403
    denied = factory.session.scalars(
        select(AuditLog).where(AuditLog.action_type == "workflow.publish", AuditLog.object_id == str(news.id))
    ).all()
    assert [entry.result for entry in denied] == [AuditResult.DENIED]
    api.cookies.clear()
    login(api, _publisher(factory).email)
    ok = api.patch(f"{ADMIN}/content/news/{news.id}", json=change)
    assert ok.status_code == 200 and ok.json()["workflow_status"] == status.value


def test_draft_is_edited_without_publishing_rights(api, factory):
    news = _news(factory, WorkflowStatus.DRAFT)
    login(api, factory.user(RoleCode.EDITOR).email)
    assert api.patch(f"{ADMIN}/content/news/{news.id}", json={"version": 1, "title": {"ru": "Черновик"}}).status_code == 200


def test_opening_a_live_document_needs_publishing_rights_but_closing_does_not(api, factory):
    document = factory.document(
        workflow_status=WorkflowStatus.PUBLISHED, description_status=DescriptionStatus.PUBLIC, file_access=FileAccess.OPEN
    )
    closed, opened = (
        factory.add(DigitalFile(owner_type="document", owner_id=document.id, master_path="x/m.jpg", mime="image/jpeg", size=1,
                                sha256=uuid.uuid4().hex + uuid.uuid4().hex, access=access, is_demo=True))
        for access in (FileAccess.CLOSED, FileAccess.OPEN)
    )
    login(api, factory.user(RoleCode.ARCHIVIST).email)
    # Widening access or other changes of public content: only through publishing rights.
    assert api.patch(f"{ADMIN}/uploads/{closed.id}", json={"access": "open"}).status_code == 403
    assert api.patch(f"{ADMIN}/uploads/{opened.id}", json={"access": "closed", "position": 5}).status_code == 403
    assert api.delete(f"{ADMIN}/uploads/{closed.id}").status_code == 403
    # Narrowing access never waits for a moderator.
    assert api.patch(f"{ADMIN}/uploads/{opened.id}", json={"access": "closed"}).json()["access"] == "closed"
    hidden = api.patch(f"{ADMIN}/catalog/document/{document.id}", json={"version": 1, "description_status": "do_not_publish"})
    assert hidden.status_code == 200 and hidden.json()["workflow_status"] == "published"
    assert api.get(f"/api/catalog/documents/{document.id}").status_code == 404
    closed_access = api.patch(f"{ADMIN}/catalog/document/{document.id}", json={"version": 2, "file_access": "closed"})
    assert closed_access.status_code == 200
    reopen = api.patch(f"{ADMIN}/catalog/document/{document.id}", json={"version": 3, "description_status": "public"})
    assert reopen.status_code == 403
    api.cookies.clear()
    login(api, factory.user(RoleCode.SUPER_ADMIN).email)
    assert api.patch(f"{ADMIN}/uploads/{closed.id}", json={"access": "open"}).json()["access"] == "open"


def test_editor_reworks_a_published_object_through_review(api, factory):
    news = _news(factory, WorkflowStatus.PUBLISHED)
    login(api, factory.user(RoleCode.EDITOR).email)
    detail = api.get(f"{ADMIN}/content/news/{news.id}").json()
    assert "rework" in detail["available_actions"]
    url = f"{ADMIN}/workflow/news/{news.id}/transitions"
    taken = api.post(url, json={"action": "rework", "version": 1})
    assert taken.status_code == 200 and taken.json()["workflow_status"] == "needs_changes"
    assert api.get(f"/api/news/{news.slug}").status_code == 404  # off the site while being changed
    edited = api.patch(f"{ADMIN}/content/news/{news.id}", json={"version": 2, "title": {"ru": "Исправлено"}})
    assert edited.status_code == 200
    assert api.post(url, json={"action": "submit", "version": 3}).json()["workflow_status"] == "review"
    assert api.post(url, json={"action": "publish", "version": 4}).status_code == 403  # the editor cannot publish


def test_branch_admin_edits_own_live_branch_via_rework(api, factory):
    branch = factory.branch()
    branch.workflow_status = WorkflowStatus.PUBLISHED
    factory.session.commit()
    login(api, factory.user(RoleCode.BRANCH_ADMIN, branch_id=branch.id).email)
    url = f"{ADMIN}/branches/{branch.id}"
    assert api.patch(url, json={"version": 1, "phone": "+7 000 000-00-00"}).status_code == 403
    taken = api.post(f"{ADMIN}/workflow/branch/{branch.id}/transitions", json={"action": "rework", "version": 1})
    assert taken.status_code == 200, taken.text
    assert api.patch(url, json={"version": 2, "phone": "+7 000 000-00-00"}).status_code == 200


def test_unverified_machine_translation_cannot_be_published(api, factory):
    news = _news(factory, WorkflowStatus.APPROVED, translation_status={"ru": "verified", "kk": "machine"})
    login(api, factory.user(RoleCode.SUPER_ADMIN).email)
    detail = api.get(f"{ADMIN}/content/news/{news.id}").json()
    assert "publish" not in detail["available_actions"]
    url = f"{ADMIN}/workflow/news/{news.id}/transitions"
    refused = api.post(url, json={"action": "publish", "version": 1})
    assert refused.status_code == 409 and refused.json() == {"detail": "unverified_translation"}
    verified = api.post(f"{ADMIN}/translations/news/{news.id}/verify", json={"lang": "kk", "version": 1})
    assert verified.status_code == 200, verified.text
    published = api.post(url, json={"action": "publish", "version": 2})
    assert published.status_code == 200, published.text


def test_passwords_and_tokens_never_reach_journal_or_logs(api, factory):
    """User creation / password reset by an admin and the visitor cabinet, end to end."""
    created_pw, reset_pw, visitor_pw = "Created-Secret-7311", "Reset-Secret-4420", "Visitor-Secret-8812"
    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    root.addHandler(handler)
    user_id = None
    try:
        login(api, factory.user(RoleCode.SUPER_ADMIN).email)
        created = api.post(f"{ADMIN}/users", json={"email": f"made-{uuid.uuid4().hex[:8]}@test.demo",
                                                   "password": created_pw, "roles": ["editor"]})
        assert created.status_code == 201, created.text
        user_id = created.json()["id"]
        assert api.post(f"{ADMIN}/users/{user_id}/password", json={"new_password": reset_pw}).status_code in (200, 204)
        staff_token = api.cookies.get(security.SESSION_COOKIE)
        api.cookies.clear()
        visitor = api.post("/api/cabinet/auth/register",
                           json={"email": f"v-{uuid.uuid4().hex[:8]}@cabinet.test", "password": visitor_pw})
        assert visitor.status_code == 201
        visitor_token = api.cookies.get("vko_visitor")
    finally:
        root.removeHandler(handler)
        if user_id is not None:
            factory.session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            factory.session.commit()
    logged = buffer.getvalue()
    for needle in (created_pw, reset_pw, visitor_pw, staff_token, visitor_token):
        assert needle not in logged
        leaked = factory.session.execute(
            text("SELECT count(*) FROM audit_logs WHERE details::text LIKE :p OR coalesce(actor, '') LIKE :p"),
            {"p": f"%{needle}%"},
        ).scalar()
        assert leaked == 0
