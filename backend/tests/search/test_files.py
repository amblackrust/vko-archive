"""T3.7: GET /api/files/{id} — server-side access check (DECISIONS.md п.14): hidden → 404."""

import uuid

import pytest

from app.models import LegalAct
from app.models.enums import DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from app.services import files as files_service
from tests.admin.conftest import login
from tests.search.conftest import add_file, public_document

CONTENT = b"DEMO file content"


def _stored(storage, name="masters/doc.txt", content=CONTENT) -> str:
    path = storage / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return name


def test_open_file_of_public_document_is_served(api, factory, storage):
    document = public_document(factory)
    file = add_file(factory, document, master_path=_stored(storage), original_name="Приказ.txt",
                    preview_path=_stored(storage, "previews/doc.png", b"\x89PNG"))
    response = api.get(f"/api/files/{file.id}")
    assert response.status_code == 200
    assert response.content == CONTENT
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "public, no-cache"  # revalidated via ETag
    assert response.headers["content-disposition"].startswith("inline")
    assert "sandbox" in response.headers["content-security-policy"]
    assert api.get(f"/api/files/{file.id}", headers={"If-None-Match": response.headers["etag"]}).status_code == 304

    preview = api.get(f"/api/files/{file.id}", params={"variant": "preview"})
    assert preview.status_code == 200 and preview.headers["content-type"] == "image/png"
    assert api.get(f"/api/files/{file.id}", params={"variant": "thumb"}).status_code == 422


@pytest.mark.parametrize(
    ("doc_values", "file_access"),
    [
        ({}, FileAccess.CLOSED),
        ({}, FileAccess.RESTRICTED),
        ({}, FileAccess.NEEDS_REVIEW),
        ({"file_access": FileAccess.CLOSED}, FileAccess.OPEN),
        ({"file_access": FileAccess.NEEDS_REVIEW}, FileAccess.OPEN),
        ({"description_status": DescriptionStatus.DO_NOT_PUBLISH}, FileAccess.OPEN),
        ({"description_status": DescriptionStatus.NEEDS_REVIEW}, FileAccess.OPEN),
        ({"workflow_status": WorkflowStatus.DRAFT}, FileAccess.OPEN),
        ({"workflow_status": WorkflowStatus.ARCHIVED}, FileAccess.OPEN),
    ],
)
def test_hidden_files_are_404_for_anonymous(api, factory, storage, doc_values, file_access):
    document = public_document(factory, **doc_values)
    file = add_file(factory, document, master_path=_stored(storage), access=file_access)
    response = api.get(f"/api/files/{file.id}")
    assert response.status_code == 404
    assert response.json() == {"detail": "not_found"}
    assert CONTENT not in response.content


def test_missing_owner_unknown_file_and_bad_paths_are_404(api, factory, storage):
    _stored(storage)
    orphan = add_file(factory, None, owner_type=None, master_path="masters/doc.txt")
    ghost_owner = add_file(factory, None, owner_type="document", master_path="masters/doc.txt")
    document = public_document(factory)
    traversal = add_file(factory, document, master_path="../../etc/passwd")
    absolute = add_file(factory, document, master_path="/etc/passwd")
    missing = add_file(factory, document, master_path="masters/nope.txt")
    no_preview = add_file(factory, document, master_path="masters/doc.txt")
    for file_id in (orphan.id, ghost_owner.id, traversal.id, absolute.id, missing.id, uuid.uuid4()):
        assert api.get(f"/api/files/{file_id}").status_code == 404
    assert api.get(f"/api/files/{no_preview.id}", params={"variant": "preview"}).status_code == 404


def test_staff_sees_closed_files_only_in_own_branch(api, factory, storage):
    branch_a, branch_b = factory.branch(), factory.branch()
    _, _, case_a = factory.catalog(branch_a)
    _, _, case_b = factory.catalog(branch_b)
    doc_a = public_document(factory, case_a, file_access=FileAccess.CLOSED, branch_id=branch_a.id)
    doc_b = public_document(factory, case_b, file_access=FileAccess.CLOSED, branch_id=branch_b.id)
    file_a = add_file(factory, doc_a, master_path=_stored(storage), access=FileAccess.CLOSED)
    file_b = add_file(factory, doc_b, master_path=_stored(storage), access=FileAccess.CLOSED)

    assert api.get(f"/api/files/{file_a.id}").status_code == 404  # anonymous

    login(api, factory.user(RoleCode.ARCHIVIST, branch_id=branch_a.id).email)
    own = api.get(f"/api/files/{file_a.id}")
    assert own.status_code == 200 and own.content == CONTENT
    assert own.headers["cache-control"] == "private, no-store"
    assert api.get(f"/api/files/{file_b.id}").status_code == 404

    api.cookies.clear()
    login(api, factory.user(RoleCode.ANALYST).email)  # no files.view
    assert api.get(f"/api/files/{file_a.id}").status_code == 404


def test_non_document_owner_must_be_published(api, factory, storage):
    act = factory.add(LegalAct(title={"ru": "ДЕМО акт"}, workflow_status=WorkflowStatus.PUBLISHED))
    draft_act = factory.add(LegalAct(title={"ru": "ДЕМО черновик"}))
    published_file = add_file(factory, act, owner_type="legal_act", master_path=_stored(storage))
    draft_file = add_file(factory, draft_act, owner_type="legal_act", master_path=_stored(storage))
    closed_file = add_file(factory, act, owner_type="legal_act", master_path=_stored(storage), access=FileAccess.CLOSED)
    assert api.get(f"/api/files/{published_file.id}").status_code == 200
    assert api.get(f"/api/files/{draft_file.id}").status_code == 404
    assert api.get(f"/api/files/{closed_file.id}").status_code == 404


def test_active_content_is_downloaded_not_rendered(api, factory, storage):
    document = public_document(factory)
    svg = add_file(factory, document, master_path=_stored(storage, "masters/x.svg", b"<svg/>"), mime="image/svg+xml")
    response = api.get(f"/api/files/{svg.id}")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment")
    assert "sandbox" in response.headers["content-security-policy"]


@pytest.mark.parametrize(
    "mime",
    ["text/html; charset=utf-8", "TEXT/HTML", "image/svg+xml;charset=utf-8", " Application/XHTML+XML ",
     "application/javascript", "application/x-unknown", ""],
)
def test_non_allowlisted_mime_is_always_an_attachment(api, factory, storage, mime):
    document = public_document(factory)
    file = add_file(factory, document, master_path=_stored(storage, "masters/x.bin", b"<script>1</script>"), mime=mime)
    response = api.get(f"/api/files/{file.id}")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment")
    assert "sandbox" in response.headers["content-security-policy"]


@pytest.mark.parametrize(
    ("mime", "served"),
    [("image/PNG", "image/png"), ("application/pdf", "application/pdf"), ("audio/mpeg", "audio/mpeg"),
     ("video/mp4", "video/mp4"), ("text/plain; charset=utf-8", "text/plain")],
)
def test_allowlisted_mime_is_inline(api, factory, storage, mime, served):
    document = public_document(factory)
    file = add_file(factory, document, master_path=_stored(storage), mime=mime)
    response = api.get(f"/api/files/{file.id}")
    assert response.headers["content-disposition"].startswith("inline")
    assert response.headers["content-type"].split(";")[0] == served


def test_visible_files_lists_only_allowed_files_without_paths(factory, storage):
    document = public_document(factory)
    allowed = add_file(factory, document, master_path="masters/a.txt", preview_path="previews/a.png", position=0)
    add_file(factory, document, master_path="masters/b.txt", access=FileAccess.CLOSED, position=1)
    refs = files_service.visible_files(factory.session, None, document)
    assert [r.id for r in refs] == [allowed.id]
    assert refs[0].url == f"/api/files/{allowed.id}"
    assert refs[0].preview_url == f"/api/files/{allowed.id}?variant=preview"
    assert "masters" not in repr(refs)

    closed_doc = public_document(factory, file_access=FileAccess.CLOSED)
    add_file(factory, closed_doc, master_path="masters/c.txt")
    assert files_service.visible_files(factory.session, None, closed_doc) == []
