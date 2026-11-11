"""T6.6: catalog import (CSV/XLSX) and export. Per-row authorization, drafts only,
idempotency by archive code, transactional apply, file safety, formula injection."""

import csv
import io
import uuid
import zipfile
from collections.abc import Iterator

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from app.main import app
from app.models import AuditLog, Document, WorkflowHistory
from app.models.enums import FileAccess, RoleCode, WorkflowStatus
from app.services import import_export
from app.services.errors import InvalidInput
from tests.admin.conftest import login

PREFIX = "IMPTEST-"


@pytest.fixture
def code() -> str:
    return f"{PREFIX}{uuid.uuid4().hex[:8]}"


@pytest.fixture(autouse=True)
def _cleanup_imported(engine: Engine, factory, api) -> Iterator[None]:
    # Depends on `factory` so it runs before factory removes cases/users the documents use;
    # `api` points the app at the test database.
    yield
    with Session(engine) as session:
        ids = list(session.scalars(select(Document.id).where(Document.archive_code.like(f"{PREFIX}%"))))
        if ids:
            session.execute(delete(WorkflowHistory).where(WorkflowHistory.object_id.in_(ids)))
            session.execute(delete(Document).where(Document.id.in_(ids)))
        session.commit()


def client_for(factory, role: RoleCode, **kwargs) -> TestClient:
    user = factory.user(role, **kwargs)
    client = TestClient(app, base_url="https://testserver")
    login(client, user.email)
    return client


def make_doc(factory, case=None, **values) -> Document:
    values.setdefault("title", {"ru": "ДЕМО документ"})
    return factory.add(Document(case_id=case.id if case else None, is_demo=True, **values))


def csv_bytes(rows: list[list[str]], delimiter: str = ";") -> bytes:
    buffer = io.StringIO()
    csv.writer(buffer, delimiter=delimiter).writerows(rows)
    return buffer.getvalue().encode("utf-8")


def xlsx_bytes(rows: list[list[object]]) -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def post(client: TestClient, action: str, data: bytes, **params) -> dict:
    response = client.post(f"/api/admin/import/{action}", content=data, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def docs(engine: Engine, prefix: str) -> list[Document]:
    with Session(engine) as session:
        return list(session.scalars(select(Document).where(Document.archive_code.like(f"{prefix}%")).order_by(Document.archive_code)))


HEADER = ["Шифр", "title_ru", "title_kk", "Дата", "date_from", "date_to", "doc_type", "Фонд", "Опись", "Дело"]


def test_preview_maps_columns_validates_and_writes_nothing(factory, engine, code):
    branch = factory.branch()
    fund, inventory, case = factory.catalog(branch)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    data = csv_bytes([
        HEADER,
        [f"{code}-1", "ДЕМО Приказ", "", "1950 г.", "1950", "1950", "order", fund.number, "1", "1"],
        [f"{code}-2", "", "", "", "", "", "", "", "", ""],
        [f"{code}-3", "ДЕМО", "", "", "31.02.1950", "", "", "", "", ""],
        [f"{code}-4", "ДЕМО", "", "", "1960", "1950", "spaceship", "", "", ""],
        [f"{code}-1", "ДЕМО дубль", "", "", "", "", "", "", "", ""],
        [f"{code}-5", "ДЕМО", "", "", "", "", "", "NOFUND", "1", "1"],
        [f"{code}-6", "ДЕМО", "", "", "", "", "", fund.number, "", ""],
    ])
    body = post(client, "preview", data, branch_id=str(branch.id))
    assert body["applied"] is False
    assert body["mapping"]["0"] == "archive_code" and body["mapping"]["7"] == "fund_number"
    rows = {row["line"]: row for row in body["rows"]}
    assert rows[2]["action"] == "create" and rows[2]["errors"] == []
    codes = {line: {e["code"] for e in row["errors"]} for line, row in rows.items()}
    assert codes[3] == {"required"}
    assert codes[4] == {"invalid_date"}
    assert codes[5] == {"date_range", "unknown_doc_type"}
    assert codes[6] == {"duplicate_in_file"}
    assert codes[7] == {"hierarchy_not_found"}
    assert codes[8] == {"hierarchy_incomplete"}
    assert body["counts"] == {"create": 1, "update": 0, "unchanged": 0, "skip": 0, "error": 6}
    assert docs(engine, code) == []


def test_apply_creates_drafts_needing_review_and_is_idempotent(factory, engine, code):
    branch = factory.branch()
    fund, _inventory, case = factory.catalog(branch)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    rows = [
        HEADER,
        [f"{code}-1", "ДЕМО Приказ", "ДЕМО Бұйрық", "1950 г.", "1950", "1950", "Order", fund.number, "1", "1"],
        [f"{code}-2", "ДЕМО Письмо", "", "", "12.05.1943", "", "letter", "", "", ""],
    ]
    target = {"branch_id": str(branch.id)}  # fund numbers are unique per archive (branch)
    body = post(client, "apply", csv_bytes(rows), **target)
    assert body["applied"] is True and body["counts"]["create"] == 2
    first, second = docs(engine, code)
    assert first.workflow_status == WorkflowStatus.DRAFT
    assert first.description_status.value == "needs_review" and first.file_access == FileAccess.NEEDS_REVIEW
    assert first.case_id == case.id and first.branch_id == branch.id  # branch from the hierarchy
    assert first.doc_type == "order" and first.period == "1950s"
    assert first.translation_status == {"ru": "verified", "kk": "verified", "en": "missing"}
    assert second.case_id is None and second.branch_id == branch.id and str(second.date_from) == "1943-05-12"
    assert all(row["object_id"] for row in body["rows"])

    again = post(client, "apply", csv_bytes(rows), **target)
    assert again["counts"] == {"create": 0, "update": 0, "unchanged": 2, "skip": 0, "error": 0}
    assert len(docs(engine, code)) == 2

    rows[2][1] = "ДЕМО Письмо (уточнено)"
    changed = post(client, "apply", csv_bytes(rows), **target)
    assert changed["counts"]["update"] == 1
    updated = docs(engine, code)[1]
    assert updated.title["ru"] == "ДЕМО Письмо (уточнено)" and updated.version == 2
    with Session(engine) as session:
        history = session.scalars(select(WorkflowHistory).where(WorkflowHistory.object_id == updated.id)).all()
        assert sorted(h.version for h in history) == [1, 2]


def test_published_document_is_not_overwritten(factory, engine, code):
    factory.document(None, archive_code=f"{code}-pub", workflow_status=WorkflowStatus.PUBLISHED)
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    body = post(client, "apply", csv_bytes([["archive_code", "title_ru"], [f"{code}-pub", "Подмена"]]))
    assert body["rows"][0]["action"] == "skip"
    assert docs(engine, f"{code}-pub")[0].title == {"ru": "ДЕМО документ"}


def test_row_errors_do_not_block_others_but_atomic_writes_nothing(factory, engine, code):
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    data = csv_bytes([["archive_code", "title_ru", "sheets_count"], [f"{code}-ok", "ДЕМО", "3"], [f"{code}-bad", "ДЕМО", "много"]])
    atomic = post(client, "apply", data, atomic="true")
    assert atomic["applied"] is False and docs(engine, code) == []
    partial = post(client, "apply", data)
    assert partial["applied"] is True
    assert [d.archive_code for d in docs(engine, code)] == [f"{code}-ok"]
    assert {e["code"] for e in partial["rows"][1]["errors"]} == {"invalid_number"}


def test_branch_scoped_archivist_imports_only_into_own_branch(factory, engine, code):
    own, other = factory.branch(), factory.branch()
    own_fund, _, _ = factory.catalog(own)
    other_fund, _, _ = factory.catalog(other)
    foreign = factory.document(None, archive_code=f"{code}-foreign", branch_id=other.id)
    client = client_for(factory, RoleCode.ARCHIVIST, branch_id=own.id)
    # Hierarchy is resolved inside the archivist's own branch: another branch's fund is not found.
    data = csv_bytes([
        ["archive_code", "title_ru", "fund_number", "inventory_number", "case_number"],
        [f"{code}-own", "ДЕМО", own_fund.number, "1", "1"],
        [f"{code}-loose", "ДЕМО", "", "", ""],
        [f"{code}-other", "ДЕМО", other_fund.number, "1", "1"],
        [f"{code}-foreign", "ДЕМО правка", "", "", ""],
    ])
    body = post(client, "apply", data)
    actions = {row["archive_code"]: (row["action"], {e["code"] for e in row["errors"]}) for row in body["rows"]}
    assert actions[f"{code}-own"] == ("create", set())
    assert actions[f"{code}-loose"] == ("create", set())
    assert actions[f"{code}-other"] == ("error", {"hierarchy_not_found"})
    assert actions[f"{code}-foreign"] == ("error", {"forbidden_existing"})
    created = {d.archive_code: d for d in docs(engine, code)}
    assert created[f"{code}-loose"].branch_id == own.id
    assert created[f"{code}-foreign"].title == {"ru": "ДЕМО документ"} and foreign.id == created[f"{code}-foreign"].id
    # Explicit target branch of someone else → 403 before anything is read.
    denied = client.post("/api/admin/import/preview", content=data, params={"branch_id": str(other.id)})
    assert denied.status_code == 403


def test_import_requires_permission_and_session(factory, code):
    editor = client_for(factory, RoleCode.EDITOR)  # no catalog.import in the default matrix
    data = csv_bytes([["archive_code", "title_ru"], [f"{code}-1", "ДЕМО"]])
    assert editor.post("/api/admin/import/apply", content=data).status_code == 403
    anonymous = TestClient(app, base_url="https://testserver")
    assert anonymous.post("/api/admin/import/apply", content=data).status_code == 401
    assert editor.get("/api/admin/export/documents").status_code == 403


def test_xlsx_import(factory, engine, code):
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    data = xlsx_bytes([["archive_code", "title_ru", "date_from", "sheets_count"], [f"{code}-x", "ДЕМО XLSX", 1955, 12.0]])
    body = post(client, "apply", data)
    assert body["counts"]["create"] == 1
    doc = docs(engine, code)[0]
    assert doc.sheets_count == 12 and doc.period == "1950s"


def _zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def test_unsafe_and_oversized_files_are_rejected(factory):
    client = client_for(factory, RoleCode.SUPER_ADMIN)

    def detail(data: bytes) -> str:
        response = client.post("/api/admin/import/preview", content=data)
        assert response.status_code == 422, response.text
        return response.json()["detail"]

    # XXE / billion laughs: any DOCTYPE in the package is refused before parsing.
    xxe = xlsx_bytes([["archive_code", "title_ru"], ["X", "Y"]])
    with zipfile.ZipFile(io.BytesIO(xxe)) as source:
        entries = {name: source.read(name) for name in source.namelist()}
    entries["xl/worksheets/sheet1.xml"] = b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>'
    assert detail(_zip(entries)) == "unsafe_file"
    # Zip bomb: huge declared size, tiny archive.
    assert detail(_zip({"xl/worksheets/sheet1.xml": b"0" * (61 * 1024 * 1024)})) == "file_too_complex"
    assert detail(b"\xd0\xcf\x11\xe0" + b"\0" * 100) == "unsupported_format"
    assert detail(b"PK\x03\x04garbage") == "invalid_file"
    assert detail(b"") == "empty_file"
    assert detail(b"a;b\n" + b"x;y\n" * (import_export.MAX_ROWS + 1)) == "too_many_rows"
    big = client.post("/api/admin/import/preview", content=b"x" * (import_export.MAX_FILE_BYTES + 1))
    assert big.status_code == 422 and big.json()["detail"] == "file_too_large"
    assert detail(csv_bytes([["title_ru"], ["x"]])) == "mapping_missing_archive_code"


def test_mapping_param(factory, code):
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    data = csv_bytes([["код", "имя"], [f"{code}-m", "ДЕМО"]])
    body = post(client, "preview", data, mapping='{"0": "archive_code", "1": "title_en"}')
    assert body["rows"][0]["values"] == {"archive_code": f"{code}-m", "title_en": "ДЕМО"}
    bad = client.post("/api/admin/import/preview", content=data, params={"mapping": '{"0": "archive_code", "1": "archive_code"}'})
    assert bad.json()["detail"] == "mapping_duplicate_field"
    bad = client.post("/api/admin/import/preview", content=data, params={"mapping": '{"0": "password_hash", "1": "title_en"}'})
    assert bad.json()["detail"] == "mapping_unknown_field"


def test_export_neutralizes_formulas_and_respects_branch(factory, engine, code):
    own, other = factory.branch(), factory.branch()
    make_doc(factory, None, archive_code=f"{code}-own", branch_id=own.id, title={"ru": "=HYPERLINK(\"http://x\")"})
    make_doc(factory, None, archive_code=f"{code}-other", branch_id=other.id, title={"ru": "ДЕМО чужой"})
    archivist = client_for(factory, RoleCode.ARCHIVIST, branch_id=own.id)
    response = archivist.get("/api/admin/export/documents", params={"format": "csv"})
    assert response.status_code == 200
    text = response.content.decode("utf-8-sig")
    assert f"{code}-own" in text and f"{code}-other" not in text
    assert "'=HYPERLINK" in text
    assert archivist.get("/api/admin/export/documents", params={"branch_id": str(other.id)}).status_code == 403

    xlsx = archivist.get("/api/admin/export/documents", params={"format": "xlsx"})
    sheet = openpyxl.load_workbook(io.BytesIO(xlsx.content), read_only=True).worksheets[0]
    rows = list(sheet.iter_rows(values_only=True))
    title_col = rows[0].index("title_ru")
    own_row = next(r for r in rows if r[0] == f"{code}-own")
    assert own_row[title_col].startswith("'=")
    with Session(engine) as session:
        assert session.scalar(select(AuditLog).where(AuditLog.action_type == "catalog.export").limit(1)) is not None


def test_export_round_trip_is_unchanged(factory, engine, code):
    branch = factory.branch()
    fund, _, case = factory.catalog(branch)
    make_doc(factory, case, archive_code=f"{code}-rt", branch_id=branch.id, title={"ru": "-ДЕМО", "en": "Demo"},
                     translation_status={"ru": "verified", "en": "verified", "kk": "missing"})
    client = client_for(factory, RoleCode.SUPER_ADMIN)
    exported = client.get("/api/admin/export/documents", params={"branch_id": str(branch.id)}).content
    body = post(client, "apply", exported, branch_id=str(branch.id))
    row = next(r for r in body["rows"] if r["archive_code"] == f"{code}-rt")
    assert row["action"] == "unchanged", row


def test_safe_cell_and_read_limits():
    assert import_export.safe_cell("=1+1") == "'=1+1"
    assert import_export.safe_cell("  @SUM(A1)") == "'  @SUM(A1)"
    assert import_export.safe_cell("Обычный\x07текст") == "Обычныйтекст"
    with pytest.raises(InvalidInput):
        import_export.read_table(b"a,b\n" + b"x\x00,y\n")


def test_branch_options(factory):
    own, _other = factory.branch(), factory.branch()
    archivist = client_for(factory, RoleCode.ARCHIVIST, branch_id=own.id)
    assert [b["id"] for b in archivist.get("/api/admin/import/branches").json()] == [str(own.id)]
    analyst = client_for(factory, RoleCode.ANALYST)
    assert analyst.get("/api/admin/import/branches").status_code == 403
