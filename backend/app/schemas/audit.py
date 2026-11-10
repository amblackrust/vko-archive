import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEntry(BaseModel):
    id: int
    ts: datetime
    user_id: uuid.UUID | None
    actor: str | None
    action_type: str
    object_type: str | None
    object_id: str | None
    result: str
    details: dict[str, Any]
    ip: str | None


class AuditPage(BaseModel):
    items: list[AuditEntry]
    total: int
    page: int
    page_size: int
