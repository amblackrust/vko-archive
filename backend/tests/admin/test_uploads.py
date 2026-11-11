import io
import uuid

import pytest
from PIL import Image
from sqlalchemy import select

from app.config import Settings, get_settings
from app.main import app
from app.models import DigitalFile
from app.models.enums import FileAccess, RoleCode
from tests.admin.conftest import login

URL = "/api/admin/uploads"


@pytest.fixture
def storage(tmp_path):
    base = get_settings()
    settings = Settings(**{**base.model_dump(), "storage_dir": tmp_path})
    app.dependency_overrides[get_settings] = lambda: settings
    yield tmp_path
    app.dependency_overrides.pop(get_settings, None)


def _png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(out, "PNG")
    return out.getvalue()


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _upload(api, doc, name, data):
    return api.post(URL, params={"owner_type": "document", "owner_id": str(doc.id), "filename": name}, content=data)


def _drop_files(factory):
    s = factory.session
    s.rollback()
    s.query(DigitalFile).filter(DigitalFile.original_name.like("demo-up-%")).delete(synchronize_session=False)
    s.commit()


def test_upload_png_is_stored_closed_with_preview(api, factory, storage):
    _, _, case = factory.catalog(None)
    doc = factory.document(case)
    _as(api, factory.user(RoleCode.ARCHIVIST))
    r = _upload(api, doc, "demo-up-scan.png", _png())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["access"] == "needs_review" and body["mime"] == "image/png" and body["preview_url"]
    assert "master_path" not in body and str(storage) not in r.text
    row = factory.session.get(DigitalFile, uuid.UUID(body["id"]))
    assert (storage / row.master_path).is_file() and (storage / row.preview_path).read_bytes()[:4] == b"RIFF"
    assert not list((storage / "tmp").glob("*"))
    factory.session.refresh(doc)
    assert doc.has_digital_copy is True

    # Closed until access is set explicitly; anonymous gets 404.
    anon = api.__class__(app, base_url="https://testserver")
    assert anon.get(body["url"]).status_code == 404
    opened = api.patch(f"{URL}/{body['id']}", json={"access": "open"})
    assert opened.status_code == 200 and opened.json()["access"] == FileAccess.OPEN.value
    listing = api.get(URL, params={"owner_type": "document", "owner_id": str(doc.id)}).json()
    assert [f["id"] for f in listing] == [body["id"]]

    assert api.delete(f"{URL}/{body['id']}").status_code == 204
    assert not (storage / row.master_path).exists()
    factory.session.refresh(doc)
    assert doc.has_digital_copy is False
    _drop_files(factory)


def test_rejects_disguised_oversized_and_unknown_files(api, factory, storage, monkeypatch):
    _, _, case = factory.catalog(None)
    doc = factory.document(case)
    _as(api, factory.user(RoleCode.ARCHIVIST))
    html = b"<html><script>alert(1)</script></html>" + b" " * 64
    assert _upload(api, doc, "demo-up-a.png", html).status_code == 415
    assert _upload(api, doc, "demo-up-b.html", html).status_code == 415
    assert _upload(api, doc, "demo-up-c.pdf", _png()).status_code == 415  # extension disagrees with the signature
    assert _upload(api, doc, "demo-up-d.png", b"\x89PNG\r\n\x1a\n" + b"junk" * 20).status_code == 422
    assert _upload(api, doc, "demo-up-e.png", b"").status_code == 415
    monkeypatch.setitem(__import__("app.services.admin_uploads", fromlist=["x"]).LIMITS, "image", 40)
    assert _upload(api, doc, "demo-up-f.png", _png()).status_code == 413
    assert factory.session.scalars(select(DigitalFile).where(DigitalFile.original_name.like("demo-up-%"))).first() is None
    assert not list((storage / "tmp").glob("*"))


def test_upload_permissions_and_branch_scope(api, factory, storage):
    mine, other = factory.branch(), factory.branch()
    _, _, other_case = factory.catalog(other)
    other_doc = factory.document(other_case)
    _as(api, factory.user(RoleCode.ARCHIVIST, branch_id=mine.id))
    assert _upload(api, other_doc, "demo-up-x.png", _png()).status_code == 403
    _as(api, factory.user(RoleCode.MODERATOR))
    assert _upload(api, other_doc, "demo-up-x.png", _png()).status_code == 403
    api.cookies.clear()
    assert _upload(api, other_doc, "demo-up-x.png", _png()).status_code in (401, 403)
