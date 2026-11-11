import uuid

from app.models import Exhibit, Exhibition, WorkflowHistory
from app.models.enums import RoleCode
from tests.admin.conftest import login

URL = "/api/admin"


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _cleanup(factory, exhibition_id):
    s = factory.session
    s.rollback()
    for exhibit in s.query(Exhibit).filter_by(exhibition_id=exhibition_id):
        s.execute(WorkflowHistory.__table__.delete().where(WorkflowHistory.object_id == exhibit.id))
        s.delete(exhibit)
    s.execute(WorkflowHistory.__table__.delete().where(WorkflowHistory.object_id == exhibition_id))
    s.delete(s.get(Exhibition, exhibition_id))
    s.commit()


def test_exhibition_exhibits_reorder_and_links(api, factory):
    _, _, case = factory.catalog(None)
    document = factory.document(case)
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    exhibition = api.post(
        f"{URL}/exhibitions", json={"slug": f"demo-{uuid.uuid4().hex[:8]}", "title": {"ru": "ДЕМО выставка"}, "theme": "war", "is_demo": True}
    )
    assert exhibition.status_code == 201, exhibition.text
    ex_id = exhibition.json()["id"]
    ids = []
    for n in range(3):
        r = api.post(f"{URL}/exhibits", json={"exhibition_id": ex_id, "title": {"ru": f"Экспонат {n}"}, "is_demo": True})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    assert [e["values"]["position"] for e in api.get(f"{URL}/exhibitions/{ex_id}/exhibits").json()] == [0, 1, 2]

    order = [ids[2], ids[0], ids[1]]
    moved = api.put(f"{URL}/exhibitions/{ex_id}/exhibits/order", json={"ids": order})
    assert moved.status_code == 200 and [e["id"] for e in moved.json()] == order
    assert api.put(f"{URL}/exhibitions/{ex_id}/exhibits/order", json={"ids": order[:2]}).json()["detail"] == "invalid_order"

    linked = api.patch(f"{URL}/exhibits/{ids[0]}", json={"version": 2, "document_id": str(document.id), "archive_code": "ДЕМО-1"})
    assert linked.status_code == 200, linked.text
    assert api.patch(f"{URL}/exhibits/{ids[0]}", json={"version": 3, "document_id": str(uuid.uuid4())}).json()["detail"] == "unknown_link"
    unsafe = api.patch(f"{URL}/exhibits/{ids[1]}", json={"version": 2, "media_url": "javascript:alert(1)"})
    assert unsafe.status_code == 422
    assert api.patch(f"{URL}/exhibits/{ids[1]}", json={"version": 2, "media_url": "https://example.org/v"}).status_code == 200
    assert api.patch(f"{URL}/exhibits/{ids[1]}", json={"version": 1, "caption": {"ru": "x"}}).status_code == 409
    assert api.patch(f"{URL}/exhibits/{ids[1]}", json={"version": 3, "media_file_id": str(uuid.uuid4())}).json()["detail"] == "file_not_owned"
    assert api.delete(f"{URL}/exhibitions/{ex_id}").status_code == 403
    _cleanup(factory, uuid.UUID(ex_id))


def test_publication_only_through_workflow_and_permissions(api, factory):
    analyst = factory.user(RoleCode.ANALYST)
    _as(api, analyst)
    assert api.get(f"{URL}/exhibitions").status_code == 403
    assert api.post(f"{URL}/exhibitions", json={"slug": "x-y", "title": {"ru": "ДЕМО"}}).status_code == 403
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    r = api.post(f"{URL}/exhibitions", json={"slug": f"demo-{uuid.uuid4().hex[:8]}", "title": {"ru": "ДЕМО"}, "workflow_status": "published"})
    assert r.status_code == 422
    created = api.post(f"{URL}/exhibitions", json={"slug": f"demo-{uuid.uuid4().hex[:8]}", "title": {"ru": "ДЕМО"}}).json()
    assert api.patch(f"{URL}/exhibitions/{created['id']}", json={"version": 1, "workflow_status": "published"}).status_code == 422
    # Remove: editors cannot delete, clean through the DB.
    _cleanup(factory, uuid.UUID(created["id"]))
