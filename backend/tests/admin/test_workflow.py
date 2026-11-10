import uuid

from sqlalchemy import select

from app.models import AuditLog, DigitalFile, News, Notification
from app.models.enums import AuditResult, DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from app.services.authz import FILE_DOWNLOAD, FileTarget, authorize
from tests.admin.conftest import login


def _news(factory, author):
    return factory.add(News(title={"ru": "ДЕМО новость"}, created_by=author.id, is_demo=True))


def _transition(api, object_type, obj_id, action, version, comment=None):
    return api.post(
        f"/api/admin/workflow/{object_type}/{obj_id}/transitions",
        json={"action": action, "version": version, "comment": comment},
    )


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def test_full_cycle_with_history_notifications_and_audit(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    moderator = factory.user(RoleCode.MODERATOR)
    news = _news(factory, editor)

    _as(api, editor)
    submitted = _transition(api, "news", news.id, "submit", 1)
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["workflow_status"] == "review" and submitted.json()["version"] == 2
    assert submitted.json()["available_actions"] == []  # the editor cannot review

    _as(api, moderator)
    bell = api.get("/api/admin/notifications").json()
    mine = [n for n in bell["items"] if n["object_id"] == str(news.id)]
    assert mine and mine[0]["kind"] == "workflow.submit" and bell["unread"] >= 1

    assert _transition(api, "news", news.id, "return", 2).json() == {"detail": "comment_required"}
    returned = _transition(api, "news", news.id, "return", 2, "Уточните дату")
    assert returned.json()["workflow_status"] == "needs_changes"

    _as(api, editor)
    note = next(n for n in api.get("/api/admin/notifications").json()["items"] if n["kind"] == "workflow.return")
    assert note["message"]["ru"] == "Материал возвращён на доработку"
    assert api.post(f"/api/admin/notifications/{note['id']}/read").status_code == 204
    assert _transition(api, "news", news.id, "submit", 3).status_code == 200

    _as(api, moderator)
    for action, version, status in (("approve", 4, "approved"), ("publish", 5, "published"), ("archive", 6, "archived"), ("restore", 7, "draft")):
        response = _transition(api, "news", news.id, action, version)
        assert response.status_code == 200, (action, response.text)
        assert response.json()["workflow_status"] == status

    history = api.get(f"/api/admin/workflow/news/{news.id}/history")
    assert history.status_code == 200
    entries = history.json()
    assert [e["to_status"] for e in entries] == ["review", "needs_changes", "review", "approved", "published", "archived", "draft"]
    assert entries[1]["comment"] == "Уточните дату"
    assert entries[1]["changes"] == [{"field": "workflow_status", "old": "review", "new": "needs_changes"}]
    assert [e["version"] for e in entries] == [2, 3, 4, 5, 6, 7, 8]

    audit = factory.session.scalars(
        select(AuditLog.action_type).where(AuditLog.object_id == str(news.id), AuditLog.result == AuditResult.SUCCESS)
    ).all()
    assert {"workflow.submit", "workflow.return", "workflow.approve", "workflow.publish"} <= set(audit)
    assert api.post("/api/admin/notifications/read-all").status_code == 204
    assert api.get("/api/admin/notifications?unread_only=true").json()["unread"] == 0


def test_status_change_cannot_bypass_permissions(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    news = _news(factory, editor)
    _as(api, editor)
    assert _transition(api, "news", news.id, "submit", 1).status_code == 200
    denied = _transition(api, "news", news.id, "approve", 2)
    assert denied.status_code == 403
    factory.session.refresh(news)
    assert news.workflow_status == WorkflowStatus.REVIEW and news.version == 2
    row = factory.session.scalars(
        select(AuditLog).where(AuditLog.user_id == editor.id, AuditLog.action_type == "workflow.review")
    ).one()
    assert row.result == AuditResult.DENIED and row.object_id == str(news.id)


def test_conflicts_and_invalid_input(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    news = _news(factory, editor)
    _as(api, editor)
    assert _transition(api, "news", news.id, "submit", 99).json() == {"detail": "version_conflict"}
    assert _transition(api, "news", news.id, "publish", 1).status_code == 403  # editor lacks publish

    superadmin = factory.user(RoleCode.SUPER_ADMIN)
    _as(api, superadmin)
    assert _transition(api, "news", news.id, "publish", 1).json() == {"detail": "invalid_transition"}
    assert _transition(api, "news", news.id, "fly", 1).status_code == 422
    assert _transition(api, "unicorn", news.id, "submit", 1).status_code == 404
    assert _transition(api, "news", uuid.uuid4(), "submit", 1).status_code == 404


def test_branch_admin_limited_to_own_branch(api, factory):
    branch_a, branch_b = factory.branch(), factory.branch()
    fund_a, _, _ = factory.catalog(branch_a)
    fund_b, _, _ = factory.catalog(branch_b)
    branch_admin = factory.user(RoleCode.BRANCH_ADMIN, branch_id=branch_a.id)
    _as(api, branch_admin)
    assert _transition(api, "fund", fund_b.id, "submit", 1).status_code == 403
    assert _transition(api, "fund", fund_a.id, "submit", 1).status_code == 200
    assert api.get(f"/api/admin/workflow/fund/{fund_b.id}/history").status_code == 403


def test_publishing_a_document_does_not_open_its_files(api, factory):
    _, _, case = factory.catalog(factory.branch())
    document = factory.document(
        case,
        workflow_status=WorkflowStatus.APPROVED,
        description_status=DescriptionStatus.PUBLIC,
        file_access=FileAccess.CLOSED,
    )
    file = factory.add(
        DigitalFile(owner_type="document", owner_id=document.id, master_path="demo/closed.pdf",
                    mime="application/pdf", size=1, sha256="0" * 64, access=FileAccess.CLOSED, is_demo=True)
    )
    _as(api, factory.user(RoleCode.MODERATOR))
    assert _transition(api, "document", document.id, "publish", 1).status_code == 200

    factory.session.refresh(document)
    factory.session.refresh(file)
    assert document.workflow_status == WorkflowStatus.PUBLISHED
    assert document.file_access == FileAccess.CLOSED and file.access == FileAccess.CLOSED
    assert document.branch_id == case.inventory.fund.branch_id  # derived from the hierarchy on save
    assert not authorize(None, FILE_DOWNLOAD, FileTarget(file, document))


def test_foreign_notification_is_not_found(api, factory):
    owner = factory.user(RoleCode.EDITOR)
    note = factory.add(Notification(user_id=owner.id, kind="workflow.submit", message={"ru": "x"}))
    _as(api, factory.user(RoleCode.EDITOR))
    assert api.post(f"/api/admin/notifications/{note.id}/read").status_code == 404
