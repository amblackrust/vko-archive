"""Action journal (T6.13).

`record()` adds an entry to the caller's transaction; the caller commits. `details` are
sanitized: any key that looks like a secret (password, token, csrf, hash, cookie, ...)
is replaced with "[redacted]" at every nesting level, so secrets never reach the journal.
"""

import csv
import io
import json
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.models import AuditLog
from app.models.enums import AuditResult
from app.repositories import audit as audit_repo
from app.repositories.audit import AuditFilter  # noqa: F401  (re-exported: routers build filters from it)
from app.services import authz  # module import: authz also imports this module

if TYPE_CHECKING:
    from app.services.authz import AuthUser

REDACTED = "[redacted]"
_SECRET_MARKERS = (
    "password",
    "passwd",
    "secret",
    "token",
    "csrf",
    "hash",
    "cookie",
    "authorization",
    "jwt",
    "api_key",
    "apikey",
    "session",
    "credential",
)
EXPORT_LIMIT = 10_000
EXPORT_COLUMNS = ("ts", "user_id", "actor", "action_type", "object_type", "object_id", "result", "ip", "details")


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): REDACTED if any(m in str(key).lower() for m in _SECRET_MARKERS) else sanitize(item)
            for key, item in value.items()
        }
    if isinstance(value, list | tuple | set):
        return [sanitize(item) for item in value]
    if value is None or isinstance(value, bool | int | float | str):
        return value
    return str(value)


def record(
    session: Session,
    *,
    action_type: str,
    result: AuditResult,
    user: "AuthUser | None" = None,
    actor: str | None = None,
    object_type: str | None = None,
    object_id: uuid.UUID | str | None = None,
    details: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    label = actor or (user.email if user else None)
    audit_repo.add(
        session,
        AuditLog(
            user_id=user.id if user else None,
            actor=label[:320] if label else None,
            action_type=action_type,
            object_type=object_type,
            object_id=str(object_id) if object_id is not None else None,
            result=result,
            details=sanitize(details or {}),
            ip=ip,
        ),
    )


def search(
    session: Session, user: "AuthUser", f: AuditFilter, *, page: int, page_size: int, ip: str | None
) -> tuple[list[AuditLog], int]:
    authz.require(session, user, "audit.view", ip=ip)
    return audit_repo.search(session, f, offset=(page - 1) * page_size, limit=page_size)


def _csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    # Spreadsheet formula injection: neutralize cells that start like a formula.
    if text[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


def export_csv(session: Session, user: "AuthUser", f: AuditFilter, *, ip: str | None) -> str:
    """CSV of the filtered journal (newest first, at most EXPORT_LIMIT rows); the export is journaled."""
    authz.require(session, user, "audit.export", ip=ip)
    rows, _ = audit_repo.search(session, f, offset=0, limit=EXPORT_LIMIT)
    record(session, action_type="audit.export", result=AuditResult.SUCCESS, user=user, details={"rows": len(rows)}, ip=ip)
    session.commit()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_COLUMNS)
    for row in rows:
        writer.writerow(
            [
                _csv_cell(row.ts.isoformat()),
                _csv_cell(row.user_id),
                _csv_cell(row.actor),
                _csv_cell(row.action_type),
                _csv_cell(row.object_type),
                _csv_cell(row.object_id),
                _csv_cell(row.result),
                _csv_cell(row.ip),
                _csv_cell(json.dumps(row.details, ensure_ascii=False)),
            ]
        )
    return buffer.getvalue()
