import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TransitionRequest(BaseModel):
    action: str = Field(max_length=32)  # submit / return / approve / publish / archive / restore
    version: int  # the version the user saw; a mismatch -> 409 version_conflict
    comment: str | None = Field(default=None, max_length=4000)


class TransitionResponse(BaseModel):
    object_type: str
    object_id: uuid.UUID
    workflow_status: str
    version: int
    available_actions: list[str]


class FieldChange(BaseModel):
    field: str
    old: Any
    new: Any


class HistoryEntry(BaseModel):
    id: int
    ts: datetime
    from_status: str | None
    to_status: str
    user_id: uuid.UUID | None
    comment: str | None
    version: int
    changes: list[FieldChange]


class NotificationOut(BaseModel):
    id: int
    created_at: datetime
    kind: str
    message: dict[str, str]
    object_type: str | None
    object_id: uuid.UUID | None
    is_read: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int
