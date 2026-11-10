import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.deps import ClientIp, CurrentUser, DbSession
from app.models.enums import AuditResult
from app.repositories.audit import AuditFilter
from app.schemas.audit import AuditEntry, AuditPage
from app.services import audit

router = APIRouter(prefix="/audit", tags=["admin: audit"])


def audit_filter(
    user_id: uuid.UUID | None = None,
    action_type: str | None = Query(default=None, max_length=64),
    object_type: str | None = Query(default=None, max_length=64),
    object_id: str | None = Query(default=None, max_length=64),
    result: AuditResult | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = Query(default=None, max_length=200),
) -> AuditFilter:
    return AuditFilter(
        user_id=user_id,
        action_type=action_type,
        object_type=object_type,
        object_id=object_id,
        result=result.value if result else None,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )


Filter = Annotated[AuditFilter, Depends(audit_filter)]


@router.get("", response_model=AuditPage)
def list_audit(
    f: Filter,
    user: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> AuditPage:
    rows, total = audit.search(session, user, f, page=page, page_size=page_size, ip=ip)
    return AuditPage(
        items=[AuditEntry.model_validate(row, from_attributes=True) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/export")
def export_audit(f: Filter, user: CurrentUser, session: DbSession, ip: ClientIp) -> Response:
    body = audit.export_csv(session, user, f, ip=ip)
    return Response(
        content="﻿" + body,  # BOM: Excel opens UTF-8 (Cyrillic/Kazakh) correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-log.csv"'},
    )
