"""Admin dashboard (T6.3): counters, review queue, latest journal entries. Each block is
returned only if the user may see it; branch-scoped users get their own branch's data."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Case, Document, Fund, Inventory, User
from app.models.enums import WorkflowStatus
from app.repositories import audit as audit_repo
from app.schemas.audit import AuditEntry
from app.schemas.dashboard import Dashboard, DashboardCounters, ReviewTask
from app.services import authz
from app.services.authz import AuthUser
from app.services.workflow import WORKFLOW_OBJECTS

RECENT_ACTIONS = 10
REVIEW_TASKS = 20
_TITLE_FIELDS = ("title", "name", "question", "number", "key")


def _label(obj: Any) -> str:
    for field in _TITLE_FIELDS:
        value = getattr(obj, field, None)
        if isinstance(value, dict):
            value = next((value[lang] for lang in ("ru", "kk", "en") if value.get(lang)), None)
        if value:
            return str(value)
    return str(obj.id)


def _count(session: Session, model: type, *conditions: Any) -> int:
    return session.scalar(select(func.count()).select_from(model).where(*conditions)) or 0


def _counters(session: Session, user: AuthUser) -> DashboardCounters:
    if user.branch_scoped:
        funds = _count(session, Fund, Fund.branch_id == user.branch_id)
        documents = _count(session, Document, Document.branch_id == user.branch_id)
        published = _count(
            session, Document, Document.branch_id == user.branch_id, Document.workflow_status == WorkflowStatus.PUBLISHED
        )
        inventories = cases = None
    else:
        funds = _count(session, Fund)
        documents = _count(session, Document)
        published = _count(session, Document, Document.workflow_status == WorkflowStatus.PUBLISHED)
        inventories, cases = _count(session, Inventory), _count(session, Case)
    users = None
    if authz.authorize(user, "users.view"):
        users = _count(session, User, User.is_active.is_(True))
    return DashboardCounters(
        funds=funds, inventories=inventories, cases=cases, documents=documents,
        documents_published=published, users=users,
    )


def _review_tasks(session: Session, user: AuthUser) -> tuple[int, list[ReviewTask]]:
    found: list[ReviewTask] = []
    for object_type, (model, _module) in WORKFLOW_OBJECTS.items():
        rows = session.scalars(select(model).where(model.workflow_status == WorkflowStatus.REVIEW))
        for obj in rows:
            # Same check as the transition itself: reviewers see only what they may review.
            if authz.authorize(user, "workflow.review", obj):
                found.append(
                    ReviewTask(object_type=object_type, object_id=obj.id, title=_label(obj)[:200], updated_at=obj.updated_at)
                )
    found.sort(key=lambda task: task.updated_at, reverse=True)
    return len(found), found[:REVIEW_TASKS]


def get(session: Session, user: AuthUser) -> Dashboard:
    counters = _counters(session, user) if authz.authorize(user, "catalog.view") else None
    review_total = review_tasks = None
    if authz.authorize(user, "workflow.review"):
        review_total, review_tasks = _review_tasks(session, user)
    recent = None
    if authz.authorize(user, "audit.view"):
        rows, _ = audit_repo.search(session, audit_repo.AuditFilter(), offset=0, limit=RECENT_ACTIONS)
        recent = [AuditEntry.model_validate(row, from_attributes=True) for row in rows]
    return Dashboard(counters=counters, review_total=review_total, review_tasks=review_tasks, recent_actions=recent)
