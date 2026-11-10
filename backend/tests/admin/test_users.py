"""T6.4: user management API. Anti-escalation, own roles/status, branch scoping, journal hygiene."""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from app.main import app
from app.models import AuditLog, Permission, Role, User
from app.models.enums import RoleCode
from app.security import CSRF_HEADER
from tests.admin.conftest import PASSWORD, login

DOMAIN = "@api-test.demo"
NEW_PASSWORD = "Another-Pass-77"


@pytest.fixture(autouse=True)
def _cleanup_created_users(engine: Engine) -> Iterator[None]:
    yield
    with Session(engine) as session:
        session.execute(delete(User).where(User.email.like(f"%{DOMAIN}")))
        session.commit()


@pytest.fixture
def manager_scope(engine: Engine) -> Iterator[None]:
    """Temporarily gives branch_admin users.view/users.manage (the default matrix has neither)."""
    with Session(engine) as session:
        role = session.scalars(select(Role).where(Role.code == RoleCode.BRANCH_ADMIN.value)).one()
        original = list(role.permissions)
        extra = session.scalars(select(Permission).where(Permission.module == "users")).all()
        role.permissions = [*original, *extra]
        session.commit()
    yield
    with Session(engine) as session:
        role = session.scalars(select(Role).where(Role.code == RoleCode.BRANCH_ADMIN.value)).one()
        role.permissions = [p for p in role.permissions if p.module != "users"]
        session.commit()


def client_for(factory, role: RoleCode | None, **kwargs) -> tuple[TestClient, User]:
    user = factory.user(role, **kwargs)
    client = TestClient(app, base_url="https://testserver")
    login(client, user.email)
    return client, user


def new_user_body(role: str = "editor", **extra) -> dict:
    return {"email": f"  New-{uuid.uuid4().hex[:8]}{DOMAIN.upper()} ", "full_name": "ДЕМО Новый", "password": PASSWORD,
            "roles": [role], **extra}


def test_site_admin_creates_and_edits_users(factory, api):
    site, _ = client_for(factory, RoleCode.SITE_ADMIN)
    created = site.post("/api/admin/users", json=new_user_body())
    assert created.status_code == 201, created.text
    user = created.json()
    assert user["email"] == user["email"].strip().lower() and user["roles"] == ["editor"]
    assert "password" not in str(user)

    assert site.post("/api/admin/users", json={**new_user_body(), "email": user["email"].upper()}).status_code == 409

    blocked = site.patch(f"/api/admin/users/{user['id']}", json={"is_active": False, "full_name": "ДЕМО Иной"})
    assert blocked.status_code == 200 and blocked.json()["is_active"] is False
    # The new user can log in only while active.
    fresh = TestClient(app, base_url="https://testserver")
    assert fresh.post("/api/admin/auth/login", json={"email": user["email"], "password": PASSWORD}).status_code == 401
    site.patch(f"/api/admin/users/{user['id']}", json={"is_active": True})
    assert fresh.post("/api/admin/auth/login", json={"email": user["email"], "password": PASSWORD}).status_code == 200


def test_site_admin_cannot_escalate_to_super_admin(factory, api):
    site, site_user = client_for(factory, RoleCode.SITE_ADMIN)
    assert site.post("/api/admin/users", json=new_user_body("super_admin")).status_code == 403
    assert site.post("/api/admin/users", json=new_user_body("editor", roles=["editor", "super_admin"])).status_code == 403

    victim = factory.user(RoleCode.EDITOR)
    assert site.put(f"/api/admin/users/{victim.id}/roles", json={"roles": ["editor", "super_admin"]}).status_code == 403
    # Removing the super_admin role from a super admin is just as forbidden, as is any edit.
    boss = factory.user(RoleCode.SUPER_ADMIN)
    assert site.put(f"/api/admin/users/{boss.id}/roles", json={"roles": ["editor"]}).status_code == 403
    assert site.patch(f"/api/admin/users/{boss.id}", json={"is_active": False}).status_code == 403
    assert site.post(f"/api/admin/users/{boss.id}/password", json={"new_password": NEW_PASSWORD}).status_code == 403
    assert site.get(f"/api/admin/users/{boss.id}").status_code == 403
    listed = site.get("/api/admin/users", params={"page_size": 100}).json()["items"]
    assert str(boss.id) not in {u["id"] for u in listed}


def test_nobody_changes_own_roles_or_status(factory, api):
    for role in (RoleCode.SITE_ADMIN, RoleCode.SUPER_ADMIN):
        client, me = client_for(factory, role)
        assert client.put(f"/api/admin/users/{me.id}/roles", json={"roles": ["super_admin"]}).status_code == 403
        assert client.patch(f"/api/admin/users/{me.id}", json={"is_active": False}).status_code == 403
        assert client.post(f"/api/admin/users/{me.id}/password", json={"new_password": NEW_PASSWORD}).status_code == 403


def test_super_admin_may_grant_super_admin(factory, api):
    boss, _ = client_for(factory, RoleCode.SUPER_ADMIN)
    target = boss.post("/api/admin/users", json=new_user_body("super_admin")).json()
    assert target["roles"] == ["super_admin"]
    changed = boss.put(f"/api/admin/users/{target['id']}/roles", json={"roles": ["analyst"]})
    assert changed.status_code == 200 and changed.json()["roles"] == ["analyst"]


def test_roles_without_users_permission_are_denied(factory, api):
    editor, _ = client_for(factory, RoleCode.EDITOR)
    assert editor.get("/api/admin/users").status_code == 403
    assert editor.post("/api/admin/users", json=new_user_body()).status_code == 403


def test_validation_errors(factory, api):
    site, _ = client_for(factory, RoleCode.SITE_ADMIN)
    assert site.post("/api/admin/users", json=new_user_body("nonexistent")).json()["detail"] == "unknown_role"
    assert site.post("/api/admin/users", json={**new_user_body(), "password": "short"}).json()["detail"] == "password_length"
    assert site.post("/api/admin/users", json=new_user_body("branch_admin")).json()["detail"] == "branch_required"
    unknown_branch = new_user_body("archivist", branch_id=str(uuid.uuid4()))
    assert site.post("/api/admin/users", json=unknown_branch).json()["detail"] == "unknown_branch"
    assert site.get(f"/api/admin/users/{uuid.uuid4()}").status_code == 404


def test_branch_scoped_manager_stays_in_own_branch(factory, api, manager_scope):
    mine, other = factory.branch(), factory.branch()
    manager, _ = client_for(factory, RoleCode.BRANCH_ADMIN, branch_id=mine.id)
    own = factory.user(RoleCode.ARCHIVIST, branch_id=mine.id)
    foreign = factory.user(RoleCode.ARCHIVIST, branch_id=other.id)

    ids = {u["id"] for u in manager.get("/api/admin/users", params={"page_size": 100}).json()["items"]}
    assert str(own.id) in ids and str(foreign.id) not in ids
    assert manager.get(f"/api/admin/users/{foreign.id}").status_code == 403
    assert manager.patch(f"/api/admin/users/{foreign.id}", json={"is_active": False}).status_code == 403
    assert manager.put(f"/api/admin/users/{foreign.id}/roles", json={"roles": ["editor"]}).status_code == 403

    # Create: own branch only (no branch and a foreign branch are both refused).
    assert manager.post("/api/admin/users", json=new_user_body("archivist", branch_id=str(mine.id))).status_code == 201
    assert manager.post("/api/admin/users", json=new_user_body("archivist", branch_id=str(other.id))).status_code == 403
    assert manager.post("/api/admin/users", json=new_user_body("archivist")).status_code == 403
    # A user cannot be moved to another branch (the new state is re-checked)...
    assert manager.patch(f"/api/admin/users/{own.id}", json={"branch_id": str(other.id)}).status_code == 403
    assert manager.get(f"/api/admin/users/{own.id}").json()["branch_id"] == str(mine.id)
    # ...and super_admin stays out of reach.
    assert manager.post("/api/admin/users", json=new_user_body("super_admin", branch_id=str(mine.id))).status_code == 403


def test_password_reset_ends_sessions_and_journal_has_no_secrets(factory, api, engine: Engine):
    site, _ = client_for(factory, RoleCode.SITE_ADMIN)
    target_client, target = client_for(factory, RoleCode.EDITOR)
    assert target_client.get("/api/admin/auth/me").status_code == 200

    assert site.post(f"/api/admin/users/{target.id}/password", json={"new_password": NEW_PASSWORD}).status_code == 204
    assert target_client.get("/api/admin/auth/me").status_code == 401
    fresh = TestClient(app, base_url="https://testserver")
    assert fresh.post("/api/admin/auth/login", json={"email": target.email, "password": NEW_PASSWORD}).status_code == 200

    site.patch(f"/api/admin/users/{target.id}", json={"full_name": "ДЕМО Переименован"})
    with Session(engine) as session:
        entries = session.scalars(select(AuditLog).where(AuditLog.object_id == str(target.id))).all()
        assert {"users.password_reset", "users.update"} <= {e.action_type for e in entries}
        assert NEW_PASSWORD not in str([e.details for e in entries])


def test_dashboard_blocks_depend_on_permissions(factory, api):
    boss, _ = client_for(factory, RoleCode.SUPER_ADMIN)
    body = boss.get("/api/admin/dashboard").json()
    assert body["counters"]["documents"] >= 0 and body["review_tasks"] is not None and body["recent_actions"] is not None

    analyst, _ = client_for(factory, RoleCode.ANALYST)
    body = analyst.get("/api/admin/dashboard").json()
    assert body["counters"] is None and body["review_tasks"] is None and body["recent_actions"] is None

    anonymous = TestClient(app, base_url="https://testserver")
    assert anonymous.get("/api/admin/dashboard").status_code == 401
    assert CSRF_HEADER not in anonymous.headers
