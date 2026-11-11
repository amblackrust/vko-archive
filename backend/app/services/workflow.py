"""Approval workflow (T6.12): Draft -> Review -> Needs changes -> Approved -> Published -> Archived.

Every transition is checked with authorize() (including the object's branch), changes the
row under an optimistic lock (version), stores a snapshot in workflow_history (diffs between
snapshots = version history), journals the action and notifies the people involved.
Publishing only changes workflow_status: it never touches documents.file_access or a
file's own access, so a published document with closed files keeps them closed.

Review cannot be bypassed afterwards: changing an approved or published object (any save
that is not a transition, files included) needs `workflow.publish` on it, and an object
with a machine translation that nobody has verified cannot be published.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models import (
    FAQ,
    Branch,
    Case,
    Collection,
    Document,
    Exhibit,
    Exhibition,
    Fund,
    HistoricalEvent,
    Inventory,
    LegalAct,
    MemorialDate,
    News,
    Notification,
    Page,
    Person,
    PriceListItem,
    WorkflowHistory,
)
from app.models.enums import AuditResult, WorkflowStatus
from app.repositories import users as users_repo
from app.repositories import workflow as workflow_repo
from app.services import audit, indexing
from app.services.authz import AuthUser, authorize, object_branch_id, require, sync_document_branch
from app.services.errors import Conflict, InvalidInput, NotFound

S = WorkflowStatus

# object_type (API) -> (model, permission module for viewing/editing)
WORKFLOW_OBJECTS: dict[str, tuple[type, str]] = {
    "fund": (Fund, "catalog"),
    "inventory": (Inventory, "catalog"),
    "case": (Case, "catalog"),
    "document": (Document, "catalog"),
    "branch": (Branch, "branches"),
    "news": (News, "content"),
    "page": (Page, "content"),
    "faq": (FAQ, "content"),
    "legal_act": (LegalAct, "content"),
    "price_list_item": (PriceListItem, "content"),
    "memorial_date": (MemorialDate, "content"),
    "exhibition": (Exhibition, "content"),
    "exhibit": (Exhibit, "content"),
    "collection": (Collection, "content"),
    "person": (Person, "content"),
    "historical_event": (HistoricalEvent, "content"),
}


@dataclass(frozen=True)
class Transition:
    sources: frozenset[WorkflowStatus]
    target: WorkflowStatus
    permission: str
    # Also required on the object's own module (f"{module}.{module_action}", branch-checked):
    # submitting means vouching for the content -> edit; reviewers only need to see it -> view.
    module_action: str
    comment_required: bool = False


TRANSITIONS: dict[str, Transition] = {
    "submit": Transition(frozenset({S.DRAFT, S.NEEDS_CHANGES}), S.REVIEW, "workflow.submit", "edit"),
    "return": Transition(
        frozenset({S.REVIEW, S.APPROVED}), S.NEEDS_CHANGES, "workflow.review", "view", comment_required=True
    ),
    "approve": Transition(frozenset({S.REVIEW}), S.APPROVED, "workflow.review", "view"),
    "publish": Transition(frozenset({S.APPROVED}), S.PUBLISHED, "workflow.publish", "view"),
    "archive": Transition(frozenset({S.PUBLISHED, S.APPROVED}), S.ARCHIVED, "workflow.archive", "view"),
    "restore": Transition(frozenset({S.ARCHIVED}), S.DRAFT, "workflow.archive", "view"),
}

# Who hears about a transition: reviewers on submit, the author and submitter otherwise.
_MESSAGES: dict[str, dict[str, str]] = {
    "submit": {"kk": "Материал тексеруге жіберілді", "ru": "Материал отправлен на проверку", "en": "Item submitted for review"},
    "return": {"kk": "Материал пысықтауға қайтарылды", "ru": "Материал возвращён на доработку", "en": "Item returned for changes"},
    "approve": {"kk": "Материал мақұлданды", "ru": "Материал одобрен", "en": "Item approved"},
    "publish": {"kk": "Материал жарияланды", "ru": "Материал опубликован", "en": "Item published"},
    "archive": {"kk": "Материал мұрағатқа жіберілді", "ru": "Материал архивирован", "en": "Item archived"},
    "restore": {"kk": "Материал қайтадан черновикке ауыстырылды", "ru": "Материал возвращён в черновики", "en": "Item restored to draft"},
}
# Changes to these reach the public (or are about to) without another review.
LIVE_STATUSES = frozenset({S.APPROVED, S.PUBLISHED})

# Never stored in snapshots: noisy or derived columns.
_SNAPSHOT_EXCLUDE = frozenset({"updated_at", "version"})


def _json_value(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, uuid.UUID | Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def snapshot(obj: Any) -> dict[str, Any]:
    """JSON-safe column values of a content object (for history and diffs)."""
    return {
        attr.key: _json_value(getattr(obj, attr.key))
        for attr in inspect(obj).mapper.column_attrs
        if attr.key not in _SNAPSHOT_EXCLUDE
    }


def diff(old: dict[str, Any] | None, new: dict[str, Any] | None) -> list[dict[str, Any]]:
    if old is None or new is None:
        return []
    return [
        {"field": key, "old": old.get(key), "new": new.get(key)}
        for key in sorted(old.keys() | new.keys())
        if old.get(key) != new.get(key)
    ]


def load_object(session: Session, object_type: str, object_id: uuid.UUID) -> tuple[Any, str]:
    entry = WORKFLOW_OBJECTS.get(object_type)
    if entry is None:
        raise NotFound()
    model, module = entry
    obj = session.get(model, object_id)
    if obj is None:
        raise NotFound()
    return obj, module


def require_live_edit(session: Session, user: AuthUser, obj: Any, *, ip: str | None) -> None:
    """An approved or published object may be changed only by someone who may publish it:
    otherwise an editor could change live content after (or instead of) the review."""
    if obj.workflow_status in LIVE_STATUSES:
        require(session, user, "workflow.publish", obj, ip=ip)


def has_machine_translation(obj: Any) -> bool:
    return "machine" in (getattr(obj, "translation_status", None) or {}).values()


def save_with_version(
    session: Session,
    user: AuthUser,
    object_type: str,
    obj: Any,
    expected_version: int,
    values: dict[str, Any],
    *,
    from_status: WorkflowStatus | None = None,
    comment: str | None = None,
    ip: str | None = None,
) -> int:
    """Optimistic-lock update for any workflow object, recorded in the version history.
    Raises Conflict("version_conflict") if someone saved the object in the meantime
    (→ HTTP 409). For documents the branch is re-derived from the hierarchy.
    Usable by catalog/content CRUD; does not commit. Re-indexes the object for search
    (call `indexing.embed_pending_background` as a BackgroundTask afterwards).
    A save that is not a transition (`from_status` unset) of an approved/published object
    needs `workflow.publish` (`require_live_edit`)."""
    if from_status is None:
        require_live_edit(session, user, obj, ip=ip)
    if isinstance(obj, Document):
        sync_document_branch(obj)
        values = {**values, "branch_id": obj.branch_id}
    new_version = workflow_repo.update_if_version(session, type(obj), obj.id, expected_version, values)
    if new_version is None:
        raise Conflict("version_conflict")
    session.refresh(obj)
    # Search index follows the saved state in the same transaction: unpublishing or
    # do_not_publish removes the rows before commit (vectors are filled later).
    indexing.reindex_object(session, object_type, obj)
    if {"title", "workflow_status"} & values.keys():
        # Documents' index text includes published fund/case titles.
        indexing.reindex_documents_under(session, object_type, obj)
    workflow_repo.add_history(
        session,
        WorkflowHistory(
            object_type=object_type,
            object_id=obj.id,
            from_status=(from_status or obj.workflow_status).value,
            to_status=obj.workflow_status.value,
            user_id=user.id,
            comment=comment,
            version=new_version,
            snapshot=snapshot(obj),
        ),
    )
    return new_version


def _recipients(session: Session, action: str, object_type: str, obj: Any, actor: AuthUser) -> set[uuid.UUID]:
    if action == "submit":
        branch_id = object_branch_id(obj)
        reviewers = users_repo.active_users_with_permission(session, "workflow", "review")
        # Skip reviewers bound to another branch (they could not open the item anyway).
        ids = {
            reviewer.id
            for reviewer in reviewers
            if reviewer.branch_id is None or branch_id is None or reviewer.branch_id == branch_id
        }
    else:
        submitter = workflow_repo.last_submitter(session, object_type, obj.id, S.REVIEW.value)
        ids = {uid for uid in (obj.created_by, submitter) if uid is not None}
    ids.discard(actor.id)
    return ids


def transition(
    session: Session,
    user: AuthUser,
    object_type: str,
    object_id: uuid.UUID,
    action: str,
    expected_version: int,
    comment: str | None,
    *,
    ip: str | None,
) -> Any:
    rule = TRANSITIONS.get(action)
    if rule is None:
        raise InvalidInput("unknown_transition")
    obj, module = load_object(session, object_type, object_id)
    require(session, user, rule.permission, obj, ip=ip)
    require(session, user, f"{module}.{rule.module_action}", obj, ip=ip)
    comment = (comment or "").strip() or None
    if rule.comment_required and not comment:
        raise InvalidInput("comment_required")
    current = obj.workflow_status
    if current not in rule.sources:
        raise Conflict("invalid_transition")
    if rule.target == S.PUBLISHED and has_machine_translation(obj):
        # A machine translation is a draft until a person marks the language verified.
        raise Conflict("unverified_translation")
    new_version = save_with_version(
        session, user, object_type, obj, expected_version,
        {"workflow_status": rule.target}, from_status=current, comment=comment,
    )
    for recipient in _recipients(session, action, object_type, obj, user):
        workflow_repo.add_notification(
            session,
            Notification(
                user_id=recipient,
                kind=f"workflow.{action}",
                message=_MESSAGES[action],
                object_type=object_type,
                object_id=obj.id,
            ),
        )
    audit.record(
        session,
        action_type=f"workflow.{action}",
        result=AuditResult.SUCCESS,
        user=user,
        object_type=object_type,
        object_id=obj.id,
        details={"from": current.value, "to": rule.target.value, "version": new_version},
        ip=ip,
    )
    session.commit()
    return obj


def history(session: Session, user: AuthUser, object_type: str, object_id: uuid.UUID, *, ip: str | None) -> list[dict[str, Any]]:
    """Version history with the diff of each entry against the previous snapshot."""
    obj, module = load_object(session, object_type, object_id)
    require(session, user, f"{module}.view", obj, ip=ip)
    entries = []
    previous: dict[str, Any] | None = None
    for entry in workflow_repo.history(session, object_type, obj.id):
        entries.append(
            {
                "id": entry.id,
                "ts": entry.ts,
                "from_status": entry.from_status,
                "to_status": entry.to_status,
                "user_id": entry.user_id,
                "comment": entry.comment,
                "version": entry.version,
                "changes": diff(previous, entry.snapshot),
            }
        )
        previous = entry.snapshot
    return entries


def available_actions(user: AuthUser, object_type: str, obj: Any) -> list[str]:
    """Transitions this user may run on obj now (for buttons in the admin UI)."""
    _model, module = WORKFLOW_OBJECTS[object_type]
    return [
        name
        for name, rule in TRANSITIONS.items()
        if obj.workflow_status in rule.sources
        and not (rule.target == S.PUBLISHED and has_machine_translation(obj))
        and authorize(user, rule.permission, obj)
        and authorize(user, f"{module}.{rule.module_action}", obj)
    ]


def notifications(session: Session, user: AuthUser, *, unread_only: bool, limit: int) -> tuple[list[Notification], int]:
    return (
        workflow_repo.notifications_for(session, user.id, unread_only=unread_only, limit=limit),
        workflow_repo.unread_count(session, user.id),
    )


def mark_notifications_read(session: Session, user: AuthUser, notification_id: int | None) -> None:
    count = workflow_repo.mark_read(session, user.id, notification_id)
    if notification_id is not None and count == 0:
        raise NotFound()
    session.commit()
