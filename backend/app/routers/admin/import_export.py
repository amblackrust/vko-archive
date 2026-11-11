"""Catalog import/export (T6.6). The file is sent as the raw request body (CSV or XLSX,
detected by content); options go in the query string. The body is read only after the
session (and CSRF) is checked, with a size cap."""

import json
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.deps import ClientIp, CurrentUser, DbSession
from app.models.enums import WorkflowStatus
from app.schemas.import_export import ImportFieldsOut, ImportReportOut, ImportRow, RowError
from app.schemas.users import BranchOption
from app.services import import_export
from app.services.errors import InvalidInput

router = APIRouter(tags=["admin: import/export"])


async def _upload(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    try:
        if declared is not None and int(declared) > import_export.MAX_FILE_BYTES:
            raise InvalidInput("file_too_large")
    except ValueError as exc:
        raise InvalidInput("invalid_file") from exc
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > import_export.MAX_FILE_BYTES:
            raise InvalidInput("file_too_large")
        chunks.append(chunk)
    return b"".join(chunks)


def _mapping(raw: str | None) -> dict[int, str] | None:
    """`mapping` query param: JSON object {"<column index>": "<field>" | ""}."""
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError
        return {int(key): str(value or "") for key, value in data.items()}
    except (ValueError, TypeError) as exc:
        raise InvalidInput("mapping_invalid") from exc


MappingParam = Annotated[str | None, Query(max_length=4000)]


def _out(report: import_export.ImportReport) -> ImportReportOut:
    return ImportReportOut(
        headers=report.headers,
        mapping={str(k): v for k, v in report.mapping.items()},
        suggested_mapping={str(k): v for k, v in import_export.suggest_mapping(report.headers).items()},
        fields=list(import_export.FIELDS),
        applied=report.applied,
        counts=report.counts,
        rows=[
            ImportRow(
                line=row.line,
                archive_code=row.archive_code,
                action=row.action,
                errors=[RowError(field=e["field"], code=e["code"] or "") for e in row.errors],
                values=row.raw,
                object_id=row.object_id,
            )
            for row in report.rows
        ],
    )


@router.get("/import/fields", response_model=ImportFieldsOut)
def import_fields(user: CurrentUser) -> ImportFieldsOut:
    return ImportFieldsOut(
        fields=list(import_export.FIELDS),
        required=["archive_code", "title_*"],
        max_file_bytes=import_export.MAX_FILE_BYTES,
        max_rows=import_export.MAX_ROWS,
    )


@router.get("/import/branches", response_model=list[BranchOption])
def import_branches(user: CurrentUser, session: DbSession, ip: ClientIp) -> list[BranchOption]:
    return [BranchOption(id=b.id, name=b.name) for b in import_export.branch_options(session, user, ip=ip)]


# `user` is declared before `data`: the session is checked before the body is read.
@router.post("/import/preview", response_model=ImportReportOut)
def import_preview(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    data: Annotated[bytes, Depends(_upload)],
    mapping: MappingParam = None,
    branch_id: uuid.UUID | None = None,
) -> ImportReportOut:
    return _out(import_export.preview(session, user, data, _mapping(mapping), branch_id, ip=ip))


@router.post("/import/apply", response_model=ImportReportOut)
def import_apply(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    data: Annotated[bytes, Depends(_upload)],
    mapping: MappingParam = None,
    branch_id: uuid.UUID | None = None,
    atomic: bool = False,
) -> ImportReportOut:
    return _out(import_export.apply(session, user, data, _mapping(mapping), branch_id, atomic=atomic, ip=ip))


@router.get("/export/documents")
def export_documents(
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    format: Literal["csv", "xlsx"] = "csv",
    branch_id: uuid.UUID | None = None,
    workflow_status: WorkflowStatus | None = None,
) -> Response:
    body = import_export.export_documents(
        session, user, fmt=format, branch_id=branch_id, workflow_status=workflow_status, ip=ip
    )
    media = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if format == "xlsx"
        else "text/csv; charset=utf-8"
    )
    return Response(
        content=body,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="documents.{format}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
