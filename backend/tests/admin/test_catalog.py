import uuid

from sqlalchemy import select

from app.models import AuditLog, Case, Document, Fund, Inventory, WorkflowHistory
from app.models.enums import RoleCode
from tests.admin.conftest import login

URL = "/api/admin/catalog"


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _code() -> str:
    return f"ДЕМО-{uuid.uuid4().hex[:8]}"


def _cleanup_tree(factory, *ids):
    """Objects created through the API are unknown to the factory: remove them bottom-up."""
    s = factory.session
    s.rollback()
    for model, ident in ids:
        s.execute(WorkflowHistory.__table__.delete().where(WorkflowHistory.object_id == ident))
        obj = s.get(model, ident)
        if obj is not None:
            s.delete(obj)
            s.commit()


def test_fund_accounting_fields_are_editable(api, factory):
    _as(api, factory.user(RoleCode.EDITOR))
    names = [{"dates": "1939-1945", "name": "Старое название"}, {"dates": None, "name": "ДЕМО фонд"}]
    fields = {"former_names": names, "category": 2, "ownership": "state", "restricted": "partial", "units_count": 10,
              "first_received": "1963-08-12", "source": "тест"}  # fmt: skip
    created = api.post(f"{URL}/fund", json={"number": _code(), "title": {"ru": "ДЕМО фонд"}, "type": "organization", **fields})
    assert created.status_code == 201, created.text
    fund_id = created.json()["id"]
    assert {name: created.json()["values"][name] for name in fields} == fields
    edited = api.patch(f"{URL}/fund/{fund_id}", json={"version": 1, "category": 3, "restricted": None})
    assert edited.status_code == 200, edited.text
    assert (edited.json()["values"]["category"], edited.json()["values"]["restricted"]) == (3, None)
    # A fully secret fund has no mark: it must simply stay unpublished.
    for bad in ({"restricted": "secret"}, {"category": 4}, {"ownership": "x"}, {"former_names": [{"dates": None}]}):
        assert api.patch(f"{URL}/fund/{fund_id}", json={"version": 2, **bad}).status_code == 422
    _cleanup_tree(factory, (Fund, uuid.UUID(fund_id)))


def test_create_tree_edit_and_history(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    fund = api.post(f"{URL}/fund", json={"number": _code(), "title": {"ru": "ДЕМО фонд"}, "type": "organization", "is_demo": True})
    assert fund.status_code == 201, fund.text
    fund_id = fund.json()["id"]
    assert fund.json()["workflow_status"] == "draft" and fund.json()["version"] == 1
    inv = api.post(f"{URL}/inventory", json={"fund_id": fund_id, "number": "1", "is_demo": True}).json()
    case = api.post(f"{URL}/case", json={"inventory_id": inv["id"], "number": "1", "is_demo": True}).json()
    doc = api.post(
        f"{URL}/document",
        json={"case_id": case["id"], "archive_code": _code(), "title": {"ru": "ДЕМО документ"}, "is_demo": True},
    )
    assert doc.status_code == 201, doc.text
    body = doc.json()
    # New documents are closed by default; the path shows the hierarchy.
    assert body["values"]["file_access"] == "needs_review" and body["values"]["description_status"] == "needs_review"
    assert [p["kind"] for p in body["path"]] == ["fund", "inventory", "case"]

    edited = api.patch(f"{URL}/document/{body['id']}", json={"version": 1, "summary": {"ru": "Описание"}})
    assert edited.status_code == 200, edited.text
    assert edited.json()["version"] == 2 and edited.json()["values"]["summary"] == {"ru": "Описание"}
    stale = api.patch(f"{URL}/document/{body['id']}", json={"version": 1, "summary": {"ru": "Другое"}})
    assert stale.status_code == 409 and stale.json()["detail"] == "version_conflict"

    history = api.get(f"/api/admin/workflow/document/{body['id']}/history").json()
    assert [h["version"] for h in history] == [1, 2]
    assert any(c["field"] == "summary" for c in history[-1]["changes"])
    session = factory.session
    actions = set(session.scalars(select(AuditLog.action_type).where(AuditLog.object_id == body["id"])))
    assert {"document.create", "document.update"} <= actions

    listed = api.get(f"{URL}/inventory", params={"parent_id": fund_id}).json()
    assert listed["total"] == 1 and listed["items"][0]["children"] == 1
    # A parent with children cannot be deleted; the leaf draft can.
    assert api.delete(f"{URL}/document/{body['id']}").status_code == 403  # editors have no catalog.delete
    _as(api, factory.user(RoleCode.SUPER_ADMIN))
    assert api.delete(f"{URL}/case/{case['id']}").json()["detail"] == "has_children"
    assert api.delete(f"{URL}/document/{body['id']}").status_code == 204
    assert api.delete(f"{URL}/case/{case['id']}").status_code == 204

    _cleanup_tree(factory, (Inventory, uuid.UUID(inv["id"])), (Fund, uuid.UUID(fund_id)))


def test_validation_and_no_status_override(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    assert api.post(f"{URL}/fund", json={"number": "", "title": {"ru": "x"}, "type": "organization"}).status_code == 422
    assert api.post(f"{URL}/fund", json={"number": "1", "title": {}, "type": "organization"}).json()["detail"] == "required_field"
    assert api.post(f"{URL}/fund", json={"number": "1", "title": {"fr": "x"}, "type": "organization"}).status_code == 422
    inverted = api.post(
        f"{URL}/fund", json={"number": "1", "title": {"ru": "x"}, "type": "organization", "dates_from": 1950, "dates_to": 1900}
    )
    assert inverted.json()["detail"] == "invalid_range"
    # Publication and ownership are not writable through CRUD.
    smuggled = api.post(
        f"{URL}/fund", json={"number": "1", "title": {"ru": "x"}, "type": "organization", "workflow_status": "published"}
    )
    assert smuggled.status_code == 422
    assert api.get(f"{URL}/nonsense").status_code == 404


def test_duplicate_archive_code_and_permissions(api, factory):
    _, _, case = factory.catalog(None)
    code = _code()
    factory.document(case, archive_code=code)
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    dup = api.post(f"{URL}/document", json={"case_id": str(case.id), "archive_code": code, "title": {"ru": "ДЕМО"}})
    assert dup.status_code == 409 and dup.json()["detail"] == "archive_code_taken"
    analyst = factory.user(RoleCode.ANALYST)
    _as(api, analyst)
    assert api.get(f"{URL}/fund").status_code == 403
    api.cookies.clear()
    assert api.get(f"{URL}/fund").status_code == 401


def test_branch_scope_and_derived_document_branch(api, factory):
    mine, other = factory.branch(), factory.branch()
    my_fund, _, my_case = factory.catalog(mine)
    other_fund, _, other_case = factory.catalog(other)
    my_doc = factory.document(my_case)
    other_doc = factory.document(other_case)
    archivist = factory.user(RoleCode.ARCHIVIST, branch_id=mine.id)
    _as(api, archivist)

    assert api.get(f"{URL}/fund/{other_fund.id}").status_code == 403
    assert api.patch(f"{URL}/fund/{other_fund.id}", json={"version": 1, "annotation": {"ru": "x"}}).status_code == 403
    assert api.patch(f"{URL}/document/{other_doc.id}", json={"version": 1, "summary": {"ru": "x"}}).status_code == 403
    ids = {i["id"] for i in api.get(f"{URL}/fund").json()["items"]}
    assert str(my_fund.id) in ids and str(other_fund.id) not in ids
    # Cannot create in, or move a document into, another branch.
    assert api.post(f"{URL}/fund", json={"number": _code(), "title": {"ru": "x"}, "type": "organization", "branch_id": str(other.id)}).status_code == 403
    assert api.patch(f"{URL}/document/{my_doc.id}", json={"version": 1, "case_id": str(other_case.id)}).status_code == 403
    assert api.post(f"{URL}/document", json={"case_id": str(other_case.id), "archive_code": _code(), "title": {"ru": "x"}}).status_code == 403

    own = api.get(f"{URL}/document/{my_doc.id}").json()
    assert own["values"]["branch_id"] == str(mine.id)
    # A client-sent branch cannot override the hierarchy.
    again = api.patch(f"{URL}/document/{my_doc.id}", json={"version": 1, "branch_id": str(other.id), "summary": {"ru": "x"}})
    assert again.status_code == 200 and again.json()["values"]["branch_id"] == str(mine.id)
