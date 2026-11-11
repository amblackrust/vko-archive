"""Catalog import from CSV/XLSX and export to CSV/XLSX (T6.6).

Import: upload → column mapping → preview (validation only, nothing written) → apply.
Rows are documents, matched by archive code (шифр): a new code creates a draft document,
an existing draft is updated only when something changed (re-importing the same file is a
no-op), any other existing document is skipped. Imported documents are never published:
workflow_status=draft, description_status=needs_review, file_access=needs_review.

Every row is authorized separately (catalog.import, with the branch the row lands in; an
update additionally needs catalog.edit on the existing document). Each row is written in
its own savepoint, so a failing row does not break the others; with `atomic` any error
cancels the whole import.

Untrusted input: the file size, rows, columns and cell lengths are capped; an XLSX is a
zip, checked for zip bombs (entry count, declared uncompressed size, ratio) and for
DOCTYPE/ENTITY declarations (XXE, billion laughs) before openpyxl opens it in read-only
mode with cached values (formulas are never evaluated). Export neutralizes cells that a
spreadsheet would run as formulas.
"""

import csv
import io
import logging
import re
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any

import openpyxl
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Case, Document, WorkflowHistory
from app.models.enums import AuditResult, DescriptionStatus, FileAccess, WorkflowStatus
from app.repositories import import_export as repo
from app.repositories import workflow as workflow_repo
from app.services import audit, workflow
from app.services.authz import AuthUser, authorize, require
from app.services.errors import InvalidInput, NotFound, ServiceError
from app.services.indexing import DOC_TYPE_LABELS

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLUMNS = 60
MAX_CELL_CHARS = 10_000
MAX_TITLE_CHARS = 1000
# XLSX (zip) limits
MAX_ZIP_ENTRIES = 300
MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024
MAX_COMPRESSION_RATIO = 150
EXPORT_LIMIT = 20_000

LANGS = ("kk", "ru", "en")
I18N_FIELDS = ("title", "authors", "summary", "historical_note")
HIERARCHY_FIELDS = ("fund_number", "inventory_number", "case_number")
FIELDS: tuple[str, ...] = (
    "archive_code",
    *(f"{name}_{lang}" for name in I18N_FIELDS for lang in LANGS),
    "date_text",
    "date_from",
    "date_to",
    "period",
    "doc_type",
    "language",
    "sheets_count",
    "storage_location",
    *HIERARCHY_FIELDS,
)
# Informational columns of the export; not imported (statuses are never set by a file).
EXPORT_EXTRA = ("workflow_status", "description_status", "file_access", "id")

# Header aliases for the automatic mapping (normalized: lower case, ё→е, no "№", single spaces).
_ALIASES: dict[str, str] = {
    "шифр": "archive_code",
    "архивный шифр": "archive_code",
    "archive code": "archive_code",
    "шифр документа": "archive_code",
    "заголовок": "title_ru",
    "название": "title_ru",
    "наименование": "title_ru",
    "атауы": "title_kk",
    "тақырыбы": "title_kk",
    "title": "title_en",
    "дата": "date_text",
    "даты": "date_text",
    "дата с": "date_from",
    "дата по": "date_to",
    "период": "period",
    "тип": "doc_type",
    "вид документа": "doc_type",
    "тип документа": "doc_type",
    "язык": "language",
    "листов": "sheets_count",
    "количество листов": "sheets_count",
    "кол-во листов": "sheets_count",
    "место хранения": "storage_location",
    "фонд": "fund_number",
    "опись": "inventory_number",
    "дело": "case_number",
    "аннотация": "summary_ru",
    "краткое содержание": "summary_ru",
    "автор": "authors_ru",
    "авторы": "authors_ru",
    "историческая справка": "historical_note_ru",
}

_DATE_PATTERNS = (
    (re.compile(r"^(\d{4})$"), "year"),
    (re.compile(r"^(\d{4})-(\d{2})-(\d{2})$"), "iso"),
    (re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$"), "dmy"),
)
_PERIOD_RE = re.compile(r"^\d{3}0s$")
_DOCTYPE_RE = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.IGNORECASE)
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
_EDITABLE = frozenset({WorkflowStatus.DRAFT, WorkflowStatus.NEEDS_CHANGES})


# ---------------------------------------------------------------- file reading


@dataclass
class Table:
    headers: list[str]
    rows: list[tuple[int, list[str]]]  # (line/row number in the file, cells aligned to headers)


def _cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat() if value.time() == time(0) else value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _check_xlsx_zip(data: bytes) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ZIP_ENTRIES:
                raise InvalidInput("file_too_complex")
            if sum(entry.file_size for entry in entries) > MAX_UNCOMPRESSED_BYTES:
                raise InvalidInput("file_too_complex")
            for entry in entries:
                if entry.file_size > 1024 * 1024 and entry.file_size > MAX_COMPRESSION_RATIO * max(entry.compress_size, 1):
                    raise InvalidInput("file_too_complex")
                if entry.filename.endswith((".xml", ".rels")):
                    # Reads at most the declared size (zipfile stops there), bounded above.
                    with archive.open(entry) as member:
                        if _DOCTYPE_RE.search(member.read()):
                            raise InvalidInput("unsafe_file")
    except (zipfile.BadZipFile, zipfile.LargeZipFile, OSError, EOFError, RuntimeError, NotImplementedError) as exc:
        logger.info("Import: unreadable zip (%s)", type(exc).__name__)
        raise InvalidInput("invalid_file") from exc


def _read_xlsx(data: bytes) -> list[tuple[int, list[str]]]:
    _check_xlsx_zip(data)
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True, keep_links=False)
    except Exception as exc:  # third-party parser on untrusted input: any failure = bad file
        logger.info("Import: openpyxl failed (%s)", type(exc).__name__)
        raise InvalidInput("invalid_file") from exc
    try:
        if not workbook.worksheets:
            raise InvalidInput("no_rows")
        sheet = workbook.worksheets[0]
        rows: list[tuple[int, list[str]]] = []
        for number, values in enumerate(sheet.iter_rows(values_only=True), start=1):
            cells = [_cell_text(value) for value in values]
            while cells and not cells[-1].strip():
                cells.pop()
            if not cells:
                continue
            rows.append((number, cells))
            if len(rows) > MAX_ROWS + 1:
                raise InvalidInput("too_many_rows")
        return rows
    except ServiceError:
        raise
    except Exception as exc:  # malformed sheet XML
        logger.info("Import: sheet unreadable (%s)", type(exc).__name__)
        raise InvalidInput("invalid_file") from exc
    finally:
        workbook.close()


def _read_csv(data: bytes) -> list[tuple[int, list[str]]]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1251", errors="replace")
    if "\x00" in text:
        raise InvalidInput("invalid_file")
    try:
        delimiter = csv.Sniffer().sniff(text[:4096], delimiters=",;\t").delimiter
    except csv.Error:
        delimiter = ","
    rows: list[tuple[int, list[str]]] = []
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
    try:
        for cells in reader:
            if not any(cell.strip() for cell in cells):
                continue
            rows.append((reader.line_num, cells))
            if len(rows) > MAX_ROWS + 1:
                raise InvalidInput("too_many_rows")
    except csv.Error as exc:
        raise InvalidInput("invalid_file") from exc
    return rows


def read_table(data: bytes) -> Table:
    if not data:
        raise InvalidInput("empty_file")
    if len(data) > MAX_FILE_BYTES:
        raise InvalidInput("file_too_large")
    if data.startswith(b"PK\x03\x04"):
        raw = _read_xlsx(data)
    elif data.startswith(b"\xd0\xcf\x11\xe0"):  # legacy .xls / OLE
        raise InvalidInput("unsupported_format")
    else:
        raw = _read_csv(data)
    if not raw:
        raise InvalidInput("no_rows")
    _, header_cells = raw[0]
    headers = [cell.strip() for cell in header_cells]
    while headers and not headers[-1]:
        headers.pop()
    if len(headers) > MAX_COLUMNS:
        raise InvalidInput("too_many_columns")
    named = [h for h in headers if h]
    if len(named) != len(set(named)):
        raise InvalidInput("duplicate_header")
    rows = [(line, (cells + [""] * len(headers))[: len(headers)]) for line, cells in raw[1:]]
    if not rows:
        raise InvalidInput("no_rows")
    if len(rows) > MAX_ROWS:
        raise InvalidInput("too_many_rows")
    return Table(headers=headers, rows=rows)


# ---------------------------------------------------------------- mapping


def _normalize_header(header: str) -> str:
    text = header.lower().replace("ё", "е").replace("№", " ").replace("_", " ")
    return " ".join(text.split())


def suggest_mapping(headers: list[str]) -> dict[int, str]:
    """Column index → field, for headers that equal a field name or a known alias."""
    by_name = {_normalize_header(name): name for name in FIELDS}
    mapping: dict[int, str] = {}
    used: set[str] = set()
    for index, header in enumerate(headers):
        key = _normalize_header(header)
        target = by_name.get(key) or _ALIASES.get(key)
        if target and target not in used:
            mapping[index] = target
            used.add(target)
    return mapping


def _check_mapping(headers: list[str], mapping: dict[int, str] | None) -> dict[int, str]:
    if mapping is None:
        mapping = suggest_mapping(headers)
    clean: dict[int, str] = {}
    for index, name in mapping.items():
        if not name:
            continue
        if not 0 <= index < len(headers):
            raise InvalidInput("mapping_unknown_column")
        if name not in FIELDS:
            raise InvalidInput("mapping_unknown_field")
        clean[index] = name
    targets = list(clean.values())
    if len(targets) != len(set(targets)):
        raise InvalidInput("mapping_duplicate_field")
    if "archive_code" not in targets:
        raise InvalidInput("mapping_missing_archive_code")
    if not any(t.startswith("title_") for t in targets):
        raise InvalidInput("mapping_missing_title")
    hierarchy = [t for t in targets if t in HIERARCHY_FIELDS]
    if hierarchy and len(hierarchy) != len(HIERARCHY_FIELDS):
        raise InvalidInput("mapping_incomplete_hierarchy")
    return clean


# ---------------------------------------------------------------- row validation


@dataclass(frozen=True)
class BranchTarget:
    """authorize() object for a row that is not placed in a case: its branch is the import's."""

    branch_id: uuid.UUID | None


@dataclass
class RowPlan:
    line: int
    archive_code: str
    raw: dict[str, str]
    action: str = "create"  # create | update | unchanged | skip | error
    errors: list[dict[str, str | None]] = field(default_factory=list)
    values: dict[str, Any] = field(default_factory=dict)
    document: Document | None = None
    case: Case | None = None
    object_id: uuid.UUID | None = None

    def error(self, field_name: str | None, code: str) -> None:
        self.errors.append({"field": field_name, "code": code})
        self.action = "error"


def _clean(value: str) -> str:
    value = value.strip()
    # Round trip of our own export: "'=..." was escaped by export_rows().
    if len(value) > 1 and value[0] == "'" and value[1] in _FORMULA_START:
        value = value[1:]
    return value


def _parse_date(value: str, end: bool) -> date:
    for pattern, kind in _DATE_PATTERNS:
        match = pattern.match(value)
        if not match:
            continue
        if kind == "year":
            year = int(match.group(1))
            return date(year, 12, 31) if end else date(year, 1, 1)
        if kind == "iso":
            return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
    raise ValueError(value)


def _validate_row(plan: RowPlan, mapped: set[str]) -> None:
    """Fills plan.values from plan.raw (only mapped fields), or adds errors."""
    raw = plan.raw
    for name, text in raw.items():
        if len(text) > MAX_CELL_CHARS:
            plan.error(name, "too_long")
    code = raw.get("archive_code", "")
    if not code:
        plan.error("archive_code", "required")
    elif len(code) > 255:
        plan.error("archive_code", "too_long")
    if not any(raw.get(f"title_{lang}") for lang in LANGS):
        plan.error("title", "required")
    for lang in LANGS:
        if len(raw.get(f"title_{lang}", "")) > MAX_TITLE_CHARS:
            plan.error(f"title_{lang}", "too_long")
    for name in ("date_text", "storage_location"):
        if len(raw.get(name, "")) > 255:
            plan.error(name, "too_long")
    if len(raw.get("language", "")) > 32:
        plan.error("language", "too_long")
    values = plan.values
    for name in ("date_text", "storage_location", "language"):
        if name in mapped:
            values[name] = raw[name] or None
    for name, end in (("date_from", False), ("date_to", True)):
        if name in mapped:
            if raw[name]:
                try:
                    values[name] = _parse_date(raw[name], end)
                except ValueError:
                    plan.error(name, "invalid_date")
            else:
                values[name] = None
    if values.get("date_from") and values.get("date_to") and values["date_from"] > values["date_to"]:
        plan.error("date_to", "date_range")
    if "doc_type" in mapped:
        doc_type = raw["doc_type"].lower()
        if doc_type and doc_type not in DOC_TYPE_LABELS:
            plan.error("doc_type", "unknown_doc_type")
        values["doc_type"] = doc_type or None
    if "period" in mapped:
        if raw["period"] and not _PERIOD_RE.match(raw["period"]):
            plan.error("period", "invalid_period")
        values["period"] = raw["period"] or None
    if not values.get("period") and values.get("date_from"):
        values["period"] = f"{values['date_from'].year // 10 * 10}s"
    if "sheets_count" in mapped:
        if raw["sheets_count"]:
            try:
                count = int(raw["sheets_count"])
            except ValueError:
                count = -1
            if not 0 <= count <= 1_000_000:
                plan.error("sheets_count", "invalid_number")
            else:
                values["sheets_count"] = count
        else:
            values["sheets_count"] = None


def _merge_i18n(existing: dict[str, str] | None, raw: dict[str, str], name: str, mapped: set[str]) -> dict[str, str]:
    merged = dict(existing or {})
    for lang in LANGS:
        column = f"{name}_{lang}"
        if column in mapped:
            if raw[column]:
                merged[lang] = raw[column]
            else:
                merged.pop(lang, None)
    return merged


def _document_values(plan: RowPlan, existing: Document | None, mapped: set[str]) -> dict[str, Any]:
    """Column values to write (create: all; update: only mapped columns)."""
    values = dict(plan.values)
    if existing is None:
        values["archive_code"] = plan.archive_code
    for name in I18N_FIELDS:
        if any(f"{name}_{lang}" in mapped for lang in LANGS):
            values[name] = _merge_i18n(getattr(existing, name) if existing else None, plan.raw, name, mapped)
    status = dict(existing.translation_status) if existing else {}
    for lang in LANGS:
        provided = any(plan.raw.get(f"{name}_{lang}") for name in I18N_FIELDS)
        if provided:
            status[lang] = "verified"  # typed in by archive staff
        elif lang not in status:
            status[lang] = "missing"
    values["translation_status"] = status
    if plan.case is not None:
        values["case_id"] = plan.case.id
    return values


def _changed(document: Document, values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if getattr(document, key) != value}


def _plan(
    session: Session, user: AuthUser, table: Table, mapping: dict[int, str], branch_id: uuid.UUID | None
) -> list[RowPlan]:
    mapped = set(mapping.values())
    plans: list[RowPlan] = []
    for line, cells in table.rows:
        raw = {name: _clean(cells[index]) for index, name in mapping.items()}
        plans.append(RowPlan(line=line, archive_code=raw.get("archive_code", ""), raw=raw))
    seen: set[str] = set()
    for plan in plans:
        _validate_row(plan, mapped)
        if plan.archive_code:
            if plan.archive_code in seen:
                plan.error("archive_code", "duplicate_in_file")
            seen.add(plan.archive_code)
    existing = repo.documents_by_codes(session, sorted(seen))
    cases: dict[tuple[str, str, str], Case | None] = {}
    for plan in plans:
        key = tuple(plan.raw.get(name, "") for name in HIERARCHY_FIELDS)
        if any(key):
            if not all(key):
                plan.error("case_number", "hierarchy_incomplete")
            else:
                if key not in cases:
                    cases[key] = repo.find_case(session, branch_id, *key)
                plan.case = cases[key]
                if plan.case is None:
                    plan.error("case_number", "hierarchy_not_found")
        row_branch = plan.case.inventory.fund.branch_id if plan.case is not None else branch_id
        if not authorize(user, "catalog.import", BranchTarget(row_branch)):
            plan.error(None, "forbidden_branch")
        document = existing.get(plan.archive_code)
        if plan.action == "error":
            continue
        if document is None:
            plan.action = "create"
            plan.values = _document_values(plan, None, mapped)
            continue
        plan.document = document
        plan.object_id = document.id
        if not (authorize(user, "catalog.edit", document) and authorize(user, "catalog.import", document)):
            plan.error("archive_code", "forbidden_existing")
            continue
        if document.workflow_status not in _EDITABLE:
            plan.action = "skip"
            plan.errors.append({"field": "archive_code", "code": "exists_not_editable"})
            continue
        plan.values = _changed(document, _document_values(plan, document, mapped))
        plan.action = "update" if plan.values else "unchanged"
    return plans


# ---------------------------------------------------------------- preview / apply


@dataclass
class ImportReport:
    headers: list[str]
    mapping: dict[int, str]
    rows: list[RowPlan]
    applied: bool
    counts: dict[str, int]


def _report(table: Table, mapping: dict[int, str], plans: list[RowPlan], applied: bool) -> ImportReport:
    counts = {key: 0 for key in ("create", "update", "unchanged", "skip", "error")}
    for plan in plans:
        counts[plan.action] += 1
    return ImportReport(headers=table.headers, mapping=mapping, rows=plans, applied=applied, counts=counts)


def _target_branch(session: Session, user: AuthUser, branch_id: uuid.UUID | None, *, ip: str | None) -> uuid.UUID | None:
    require(session, user, "catalog.import", ip=ip)
    if branch_id is None and user.branch_scoped:
        branch_id = user.branch_id
    if branch_id is not None:
        if repo.get_branch(session, branch_id) is None:
            raise NotFound()
        require(session, user, "catalog.import", BranchTarget(branch_id), ip=ip)
    return branch_id


def branch_options(session: Session, user: AuthUser, *, ip: str | None) -> list[Any]:
    """Target branches for the import/export selectors (branch-scoped users: their own)."""
    if not authorize(user, "catalog.export"):
        require(session, user, "catalog.import", ip=ip)
    return repo.list_branches(session, user.branch_id if user.branch_scoped else None)


def preview(
    session: Session, user: AuthUser, data: bytes, mapping: dict[int, str] | None,
    branch_id: uuid.UUID | None, *, ip: str | None,
) -> ImportReport:
    """Validation only: nothing is written."""
    branch_id = _target_branch(session, user, branch_id, ip=ip)
    table = read_table(data)
    clean_mapping = _check_mapping(table.headers, mapping)
    plans = _plan(session, user, table, clean_mapping, branch_id)
    session.rollback()
    return _report(table, clean_mapping, plans, applied=False)


def _create(session: Session, user: AuthUser, plan: RowPlan, branch_id: uuid.UUID | None) -> Document:
    document = Document(
        **plan.values,
        branch_id=plan.case.inventory.fund.branch_id if plan.case is not None else branch_id,
        workflow_status=WorkflowStatus.DRAFT,
        description_status=DescriptionStatus.NEEDS_REVIEW,
        file_access=FileAccess.NEEDS_REVIEW,
        has_digital_copy=False,
        is_demo=False,
        created_by=user.id,
    )
    session.add(document)
    session.flush()
    workflow_repo.add_history(
        session,
        WorkflowHistory(
            object_type="document",
            object_id=document.id,
            from_status=WorkflowStatus.DRAFT.value,
            to_status=WorkflowStatus.DRAFT.value,
            user_id=user.id,
            comment="import",
            version=document.version,
            snapshot=workflow.snapshot(document),
        ),
    )
    return document


def apply(
    session: Session, user: AuthUser, data: bytes, mapping: dict[int, str] | None,
    branch_id: uuid.UUID | None, *, atomic: bool, ip: str | None,
) -> ImportReport:
    """Writes the valid rows, each in its own savepoint. With `atomic`, any error
    (validation or database) writes nothing."""
    branch_id = _target_branch(session, user, branch_id, ip=ip)
    table = read_table(data)
    clean_mapping = _check_mapping(table.headers, mapping)
    plans = _plan(session, user, table, clean_mapping, branch_id)
    applied = not (atomic and any(plan.action == "error" for plan in plans))
    if applied:
        for plan in plans:
            if plan.action not in ("create", "update"):
                continue
            try:
                with session.begin_nested():
                    if plan.action == "create":
                        plan.object_id = _create(session, user, plan, branch_id).id
                    else:
                        workflow.save_with_version(
                            session, user, "document", plan.document, plan.document.version, plan.values, comment="import", ip=ip
                        )
                    session.flush()
            except IntegrityError:
                plan.error("archive_code", "conflict")
            except ServiceError as exc:
                plan.error(None, exc.code)
            if atomic and plan.action == "error":
                applied = False
                break
    if not applied:
        session.rollback()
        for plan in plans:
            if plan.action == "create":
                plan.object_id = None  # rolled back
    report = _report(table, clean_mapping, plans, applied)
    audit.record(
        session,
        action_type="catalog.import",
        result=AuditResult.SUCCESS if applied else AuditResult.FAILURE,
        user=user,
        object_type="document",
        details={"rows": len(plans), "atomic": atomic, **report.counts},
        ip=ip,
    )
    session.commit()
    return report


# ---------------------------------------------------------------- export


def safe_cell(value: Any) -> str:
    """Text for a spreadsheet cell: no formula execution, no XML-illegal characters."""
    text = "" if value is None else str(value)
    text = ILLEGAL_CHARACTERS_RE.sub("", text)
    if text.lstrip()[:1] in _FORMULA_START or text[:1] in _FORMULA_START:
        return "'" + text
    return text


def _export_row(document: Document) -> list[str]:
    case = document.case
    row: dict[str, Any] = {
        "archive_code": document.archive_code,
        "date_text": document.date_text,
        "date_from": document.date_from.isoformat() if document.date_from else None,
        "date_to": document.date_to.isoformat() if document.date_to else None,
        "period": document.period,
        "doc_type": document.doc_type,
        "language": document.language,
        "sheets_count": document.sheets_count,
        "storage_location": document.storage_location,
        "fund_number": case.inventory.fund.number if case else None,
        "inventory_number": case.inventory.number if case else None,
        "case_number": case.number if case else None,
        "workflow_status": document.workflow_status.value,
        "description_status": document.description_status.value,
        "file_access": document.file_access.value,
        "id": document.id,
    }
    for name in I18N_FIELDS:
        for lang in LANGS:
            row[f"{name}_{lang}"] = (getattr(document, name) or {}).get(lang)
    return [safe_cell(row[column]) for column in (*FIELDS, *EXPORT_EXTRA)]


def export_documents(
    session: Session, user: AuthUser, *, fmt: str, branch_id: uuid.UUID | None,
    workflow_status: WorkflowStatus | None, ip: str | None,
) -> bytes:
    """Documents the user may export (branch-scoped users: own branch only), as CSV or XLSX."""
    require(session, user, "catalog.export", ip=ip)
    if user.branch_scoped:
        if branch_id is not None and branch_id != user.branch_id:
            require(session, user, "catalog.export", BranchTarget(branch_id), ip=ip)
        branch_id = user.branch_id
    documents = repo.documents_for_export(
        session, branch_id=branch_id, only_branch=branch_id is not None,
        workflow_status=workflow_status, limit=EXPORT_LIMIT,
    )
    # Defence in depth: each row is checked with the same rule as a single document.
    rows = [_export_row(doc) for doc in documents if authorize(user, "catalog.export", doc)]
    audit.record(
        session, action_type="catalog.export", result=AuditResult.SUCCESS, user=user, object_type="document",
        details={"rows": len(rows), "format": fmt, "branch_id": branch_id}, ip=ip,
    )
    session.commit()
    header = [*FIELDS, *EXPORT_EXTRA]
    if fmt == "xlsx":
        workbook = openpyxl.Workbook(write_only=True)
        sheet = workbook.create_sheet("documents")
        sheet.append(header)
        for row in rows:
            sheet.append(row)
        buffer = io.BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(header)
    writer.writerows(rows)
    return ("﻿" + text.getvalue()).encode("utf-8")  # BOM: Excel opens Cyrillic/Kazakh correctly
