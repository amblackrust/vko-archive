import uuid

from app.models import WorkflowHistory
from app.models import Branch
from app.models.enums import RoleCode
from tests.admin.conftest import login

URL = "/api/admin/branches"


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _payload(**extra):
    return {"slug": f"demo-{uuid.uuid4().hex[:8]}", "name": {"ru": "ДЕМО филиал"}, "type": "district", **extra}


def test_site_admin_crud_and_coordinates(api, factory):
    site_admin = factory.user(RoleCode.SITE_ADMIN)
    _as(api, site_admin)
    created = api.post(URL, json=_payload(lat=49.9481, lng=82.6275, hours={"ru": "Пн-Пт 9:00-18:00"}))
    assert created.status_code == 201, created.text
    branch = created.json()
    assert branch["workflow_status"] == "draft" and branch["values"]["lat"] == 49.9481

    assert api.patch(f"{URL}/{branch['id']}", json={"version": 1, "lat": None}).json()["detail"] == "coords_incomplete"
    assert api.patch(f"{URL}/{branch['id']}", json={"version": 1, "lat": 95, "lng": 10}).status_code == 422
    assert api.post(URL, json=_payload(slug="Bad Slug")).status_code == 422
    ok = api.patch(f"{URL}/{branch['id']}", json={"version": 1, "lat": 50.0, "lng": 83.0, "coords_verified": True})
    assert ok.status_code == 200 and ok.json()["version"] == 2
    assert api.patch(f"{URL}/{branch['id']}", json={"version": 1, "show_on_map": False}).status_code == 409
    assert api.delete(f"{URL}/{branch['id']}").status_code == 403  # no branches.delete in the default matrix

    # Cleanup (the factory does not know API-created rows).
    s = factory.session
    s.execute(WorkflowHistory.__table__.delete().where(WorkflowHistory.object_id == uuid.UUID(branch["id"])))
    s.delete(s.get(Branch, uuid.UUID(branch["id"])))
    s.commit()


def test_branch_admin_edits_only_own_branch(api, factory):
    mine, other = factory.branch(), factory.branch()
    admin = factory.user(RoleCode.BRANCH_ADMIN, branch_id=mine.id)
    _as(api, admin)

    listed = api.get(URL).json()
    assert [i["id"] for i in listed["items"]] == [str(mine.id)]
    assert api.get(f"{URL}/{other.id}").status_code == 403
    assert api.patch(f"{URL}/{other.id}", json={"version": 1, "phone": "+7 000"}).status_code == 403
    assert api.delete(f"{URL}/{other.id}").status_code == 403
    assert api.post(URL, json=_payload()).status_code == 403

    changed = api.patch(f"{URL}/{mine.id}", json={"version": 1, "phone": "+7 000", "hours": {"ru": "Пн-Пт"}})
    assert changed.status_code == 200, changed.text
    assert changed.json()["values"]["phone"] == "+7 000"
    # Another branch's photo cannot be attached.
    assert api.patch(f"{URL}/{mine.id}", json={"version": 2, "photo_file_id": str(uuid.uuid4())}).json()["detail"] == "file_not_owned"


def test_editor_has_no_branch_access(api, factory):
    _as(api, factory.user(RoleCode.EDITOR))
    assert api.get(URL).status_code == 403
