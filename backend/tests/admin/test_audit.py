import csv
import io

from app.models import AuditLog
from app.models.enums import AuditResult, RoleCode
from tests.admin.conftest import login


def test_audit_requires_permission(api, factory):
    login(api, factory.user(RoleCode.SITE_ADMIN).email)
    assert api.get("/api/admin/audit").status_code == 403
    assert api.get("/api/admin/audit/export").status_code == 403


def test_audit_list_filters_and_export(api, factory):
    target = factory.user(RoleCode.EDITOR)
    api.post("/api/admin/auth/login", json={"email": target.email, "password": "wrong-password"})
    factory.add(
        AuditLog(actor="=HYPERLINK(\"x\")", action_type="settings.change", result=AuditResult.SUCCESS,
                 details={"key": "socials"}, object_type="site_setting", object_id="socials")
    )

    superadmin = factory.user(RoleCode.SUPER_ADMIN)
    login(api, superadmin.email)
    page = api.get("/api/admin/audit", params={"action_type": "auth.login", "result": "failure", "q": target.email})
    assert page.status_code == 200
    body = page.json()
    assert body["total"] == 1 and body["page"] == 1
    entry = body["items"][0]
    assert entry["actor"] == target.email and entry["object_id"] == str(target.id)
    assert entry["details"] == {"reason": "wrong_password"} and entry["ts"]

    assert api.get("/api/admin/audit", params={"result": "bogus"}).status_code == 422
    assert api.get("/api/admin/audit", params={"page_size": 1000}).status_code == 422

    export = api.get("/api/admin/audit/export", params={"action_type": "settings.change"})
    assert export.status_code == 200 and export.headers["content-type"].startswith("text/csv")
    assert "attachment" in export.headers["content-disposition"]
    text = export.content.decode("utf-8")
    assert text.startswith("﻿")
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    assert rows[0] == ["ts", "user_id", "actor", "action_type", "object_type", "object_id", "result", "ip", "details"]
    hostile = next(r for r in rows[1:] if r[2].startswith("'="))
    assert hostile[3] == "settings.change"  # formula neutralized with a leading quote

    exported = api.get("/api/admin/audit", params={"action_type": "audit.export", "user_id": str(superadmin.id)}).json()
    assert exported["total"] == 1
