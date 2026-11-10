import uuid

import pytest
from sqlalchemy import select

from app.models import AuditLog, DigitalFile
from app.models.enums import AuditResult, DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from app.services.audit import REDACTED, sanitize
from app.services.authz import (
    ALL_PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    FILE_DOWNLOAD,
    AuthUser,
    FileTarget,
    authorize,
    object_branch_id,
    require,
    sync_document_branch,
)
from app.services.errors import NotFound, PermissionDenied
from tests.admin.conftest import login


def test_default_matrix_uses_known_permissions():
    for permissions in DEFAULT_ROLE_PERMISSIONS.values():
        assert permissions <= ALL_PERMISSIONS


def test_role_permissions(factory):
    superadmin = factory.auth(factory.user(RoleCode.SUPER_ADMIN))
    editor = factory.auth(factory.user(RoleCode.EDITOR))
    analyst = factory.auth(factory.user(RoleCode.ANALYST))
    moderator = factory.auth(factory.user(RoleCode.MODERATOR))
    nobody = factory.auth(factory.user(None))

    assert authorize(superadmin, "catalog.delete") and authorize(superadmin, "roles.manage")
    assert authorize(editor, "content.edit") and not authorize(editor, "workflow.publish")
    assert not authorize(editor, "roles.manage") and not authorize(editor, "audit.view")
    assert authorize(analyst, "analytics.view") and not authorize(analyst, "catalog.view")
    assert authorize(moderator, "workflow.publish") and not authorize(moderator, "content.edit")
    assert not authorize(nobody, "catalog.view")
    assert not authorize(None, "catalog.view")


def test_site_admin_cannot_manage_super_admins(factory):
    site_admin = factory.auth(factory.user(RoleCode.SITE_ADMIN))
    target_super = factory.user(RoleCode.SUPER_ADMIN)
    target_editor = factory.user(RoleCode.EDITOR)
    assert authorize(site_admin, "users.manage", target_editor)
    assert not authorize(site_admin, "users.manage", target_super)


def test_branch_scope_uses_hierarchy(factory):
    branch_a, branch_b = factory.branch(), factory.branch()
    fund_a, inventory_a, case_a = factory.catalog(branch_a)
    fund_b, _, _ = factory.catalog(branch_b)
    # The stored branch_id disagrees with the hierarchy: the hierarchy wins.
    document = factory.document(case_a, branch_id=branch_b.id)
    assert object_branch_id(document) == branch_a.id

    branch_admin = factory.auth(factory.user(RoleCode.BRANCH_ADMIN, branch_id=branch_a.id))
    assert branch_admin.branch_scoped
    for obj in (branch_a, fund_a, inventory_a, case_a, document):
        assert authorize(branch_admin, "catalog.edit", obj), obj
    assert not authorize(branch_admin, "catalog.edit", fund_b)
    assert not authorize(branch_admin, "branches.edit", branch_b)

    # A branch admin without a branch can act on nothing; an archivist without one is global.
    assert not authorize(factory.auth(factory.user(RoleCode.BRANCH_ADMIN)), "catalog.edit", fund_a)
    archivist = factory.auth(factory.user(RoleCode.ARCHIVIST))
    assert not archivist.branch_scoped and authorize(archivist, "catalog.edit", fund_b)
    scoped_archivist = factory.auth(factory.user(RoleCode.ARCHIVIST, branch_id=branch_b.id))
    assert authorize(scoped_archivist, "catalog.edit", fund_b) and not authorize(scoped_archivist, "catalog.edit", fund_a)

    sync_document_branch(document)
    assert document.branch_id == branch_a.id


def _file(owner_type, owner_id, access):
    return DigitalFile(
        id=uuid.uuid4(), owner_type=owner_type, owner_id=owner_id, master_path="demo/x.pdf",
        mime="application/pdf", size=1, sha256="0" * 64, access=access,
    )


def test_file_download_rule(factory):
    public_doc = factory.document(
        workflow_status=WorkflowStatus.PUBLISHED, description_status=DescriptionStatus.PUBLIC, file_access=FileAccess.OPEN
    )
    open_file = _file("document", public_doc.id, FileAccess.OPEN)
    assert authorize(None, FILE_DOWNLOAD, FileTarget(open_file, public_doc))
    # The file's own access level must allow it too.
    assert not authorize(None, FILE_DOWNLOAD, FileTarget(_file("document", public_doc.id, FileAccess.NEEDS_REVIEW), public_doc))
    # Wrong / missing owner.
    assert not authorize(None, FILE_DOWNLOAD, FileTarget(_file("document", uuid.uuid4(), FileAccess.OPEN), public_doc))
    assert not authorize(None, FILE_DOWNLOAD, FileTarget(open_file, None))
    assert not authorize(None, FILE_DOWNLOAD, open_file)  # not a FileTarget

    for field, value in (
        ("file_access", FileAccess.CLOSED),
        ("file_access", FileAccess.RESTRICTED),
        ("workflow_status", WorkflowStatus.APPROVED),
        ("description_status", DescriptionStatus.DO_NOT_PUBLISH),
    ):
        doc = factory.document(
            **{"workflow_status": WorkflowStatus.PUBLISHED, "description_status": DescriptionStatus.PUBLIC,
               "file_access": FileAccess.OPEN, field: value}
        )
        assert not authorize(None, FILE_DOWNLOAD, FileTarget(_file("document", doc.id, FileAccess.OPEN), doc)), field

    exhibit_file = _file("exhibit", uuid.uuid4(), FileAccess.OPEN)
    assert authorize(None, FILE_DOWNLOAD, FileTarget(exhibit_file, owner_published=True))
    assert not authorize(None, FILE_DOWNLOAD, FileTarget(exhibit_file, owner_published=False))

    # Staff with files.view may read closed files (reading room); analysts may not.
    closed_doc = factory.document(file_access=FileAccess.CLOSED)
    closed = FileTarget(_file("document", closed_doc.id, FileAccess.CLOSED), closed_doc)
    assert authorize(factory.auth(factory.user(RoleCode.ARCHIVIST)), FILE_DOWNLOAD, closed)
    assert not authorize(factory.auth(factory.user(RoleCode.ANALYST)), FILE_DOWNLOAD, closed)


def test_require_journals_denial(factory):
    editor = factory.auth(factory.user(RoleCode.EDITOR))
    with pytest.raises(PermissionDenied):
        require(factory.session, editor, "audit.view", ip="10.0.0.1")
    with pytest.raises(NotFound):
        require(factory.session, None, FILE_DOWNLOAD, None)
    row = factory.session.scalars(
        select(AuditLog).where(AuditLog.user_id == editor.id, AuditLog.action_type == "audit.view")
    ).one()
    assert row.result == AuditResult.DENIED and row.ip == "10.0.0.1"


def test_sanitize_redacts_secrets_at_any_depth():
    details = {
        "role": "editor",
        "password": "x",
        "nested": {"new_password": "y", "items": [{"api_key": "z", "ok": 1}], "csrf_token": "t"},
        "Authorization": "Bearer abc",
    }
    clean = sanitize(details)
    assert clean["role"] == "editor" and clean["password"] == REDACTED
    assert clean["nested"]["new_password"] == REDACTED and clean["nested"]["csrf_token"] == REDACTED
    assert clean["nested"]["items"][0] == {"api_key": REDACTED, "ok": 1}
    assert clean["Authorization"] == REDACTED


def test_role_matrix_api(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    login(api, editor.email)
    assert api.get("/api/admin/roles").status_code == 403

    api.cookies.clear()
    superadmin = factory.user(RoleCode.SUPER_ADMIN)
    login(api, superadmin.email)
    matrix = api.get("/api/admin/roles").json()
    assert {r["code"] for r in matrix["roles"]} == {r.value for r in RoleCode}
    assert {p["key"] for p in matrix["permissions"]} >= ALL_PERMISSIONS
    analyst_before = next(r for r in matrix["roles"] if r["code"] == "analyst")["permissions"]

    try:
        updated = api.put("/api/admin/roles/analyst/permissions", json={"permissions": analyst_before + ["catalog.view"]})
        assert updated.status_code == 200 and "catalog.view" in updated.json()["permissions"]
        analyst = factory.auth(factory.user(RoleCode.ANALYST))
        assert authorize(analyst, "catalog.view")  # the edited matrix takes effect

        bad = api.put("/api/admin/roles/analyst/permissions", json={"permissions": ["catalog.fly"]})
        assert bad.status_code == 422 and bad.json() == {"detail": "unknown_permission"}
        assert api.put("/api/admin/roles/super_admin/permissions", json={"permissions": []}).status_code == 422
        assert api.put("/api/admin/roles/nope/permissions", json={"permissions": []}).status_code == 404
    finally:
        restored = api.put("/api/admin/roles/analyst/permissions", json={"permissions": analyst_before})
        assert restored.status_code == 200

    change = factory.session.scalars(
        select(AuditLog)
        .where(AuditLog.user_id == superadmin.id, AuditLog.action_type == "permissions.change")
        .order_by(AuditLog.id)
    ).first()
    assert change.details == {"role": "analyst", "added": ["catalog.view"], "removed": []}


def test_auth_user_branch_scoped_flag():
    base = dict(id=uuid.uuid4(), email="x", full_name="", permissions=frozenset())
    assert not AuthUser(branch_id=None, roles=frozenset(), **base).branch_scoped
    assert AuthUser(branch_id=None, roles=frozenset({"branch_admin"}), **base).branch_scoped
    assert not AuthUser(branch_id=uuid.uuid4(), roles=frozenset({"archivist", "editor"}), **base).branch_scoped
