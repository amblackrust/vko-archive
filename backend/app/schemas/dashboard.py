import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.audit import AuditEntry


class DashboardCounters(BaseModel):
    funds: int
    inventories: int | None  # None: not available for a branch-scoped user
    cases: int | None
    documents: int
    documents_published: int
    users: int | None


class ReviewTask(BaseModel):
    object_type: str
    object_id: uuid.UUID
    title: str
    updated_at: datetime


class Dashboard(BaseModel):
    # Sections the user has no permission for are null (the UI hides them).
    counters: DashboardCounters | None
    review_total: int | None
    review_tasks: list[ReviewTask] | None
    recent_actions: list[AuditEntry] | None
