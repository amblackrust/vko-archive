"""Generic create / update / delete for admin-edited content objects (B14).

All content changes go through here so each one is: authorized with `authz.require()` on
the object (including its branch), saved with `workflow.save_with_version()` (optimistic
lock, version snapshot, search re-index) and journaled. Publishing is never done here:
objects are created as drafts and only `workflow.transition` changes `workflow_status`.
"""

import types
import typing
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, ValidationError, create_model
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import WorkflowHistory
from app.models.enums import AuditResult, WorkflowStatus
from app.repositories import workflow as workflow_repo
from app.services import audit, indexing, workflow
from app.services.authz import AuthUser, require
from app.services.errors import Conflict, InvalidInput, NotFound

# Objects in these states may be deleted; anything live must be archived first.
DELETABLE = frozenset({WorkflowStatus.DRAFT, WorkflowStatus.ARCHIVED})


@dataclass(frozen=True)
class Spec:
    kind: str  # workflow object_type
    model: type
    input_model: type[BaseModel]
    module: str  # permission module: catalog / branches / content
    # Fields that must carry text in at least one language ("title").
    text_required: tuple[str, ...] = ()
    # Fields set on creation only (parents): update ignores them → rejected as invalid.
    create_only: frozenset[str] = frozenset()
    patch_model: type[BaseModel] = field(init=False)

    def __post_init__(self) -> None:
        # Update payload: the same fields and constraints, all optional.
        fields = {
            name: ((typing.Annotated[(info.annotation, *info.metadata)] if info.metadata else info.annotation) | None, None)
            for name, info in self.input_model.model_fields.items()
        }
        object.__setattr__(self, "patch_model", create_model(f"{self.input_model.__name__}Patch", __base__=self.input_model, **fields))

    @property
    def non_nullable(self) -> frozenset[str]:
        def allows_none(annotation: Any) -> bool:
            return annotation is type(None) or (
                typing.get_origin(annotation) in (typing.Union, types.UnionType) and type(None) in typing.get_args(annotation)
            )

        return frozenset(n for n, f in self.input_model.model_fields.items() if not allows_none(f.annotation))

    @property
    def required(self) -> frozenset[str]:
        return frozenset(n for n, f in self.input_model.model_fields.items() if f.is_required())


def to_json(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def filled(value: Any) -> bool:
    return bool(value) if isinstance(value, dict | str | list) else value is not None


def parse(model: type[BaseModel], body: dict[str, Any]) -> dict[str, Any]:
    """Validated values of the fields actually present in the request."""
    try:
        parsed = model.model_validate(body)
    except ValidationError as exc:
        raise InvalidInput("invalid_input") from exc
    return {name: getattr(parsed, name) for name in parsed.model_fields_set}


def conflict_from(exc: IntegrityError) -> Conflict:
    text = str(exc.orig)
    if "archive_code" in text:
        return Conflict("archive_code_taken")
    if "slug" in text or "pages_key" in text:
        return Conflict("slug_taken")
    if "date_range" in text:
        return Conflict("invalid_range")
    return Conflict("duplicate_number")


def check_year_range(values: dict[str, Any], current: Any = None) -> None:
    def pick(name: str) -> Any:
        return values[name] if name in values else getattr(current, name, None)

    for low, high in (("dates_from", "dates_to"), ("date_from", "date_to")):
        a, b = pick(low), pick(high)
        if a is not None and b is not None and a > b:
            raise InvalidInput("invalid_range")


def create(
    session: Session,
    user: AuthUser,
    spec: Spec,
    body: dict[str, Any],
    *,
    scope: Callable[[dict[str, Any]], Any],
    ip: str | None,
    prepare: Callable[[dict[str, Any]], None] | None = None,
) -> Any:
    """`scope(values)` returns the object the permission is checked on (a parent or a transient
    object carrying the branch); `prepare(values)` validates references and may adjust values."""
    values = parse(spec.input_model, body)
    for name in spec.text_required:
        if not filled(values.get(name)):
            raise InvalidInput("required_field")
    check_year_range(values)
    require(session, user, f"{spec.module}.create", scope(values), ip=ip)
    if prepare is not None:
        prepare(values)
    obj = spec.model(**values, created_by=user.id)
    session.add(obj)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise conflict_from(exc) from exc
    session.refresh(obj)
    workflow_repo.add_history(
        session,
        WorkflowHistory(
            object_type=spec.kind, object_id=obj.id, from_status=None, to_status=obj.workflow_status.value,
            user_id=user.id, comment=None, version=obj.version, snapshot=workflow.snapshot(obj),
        ),
    )
    audit.record(
        session, action_type=f"{spec.kind}.create", result=AuditResult.SUCCESS, user=user,
        object_type=spec.kind, object_id=obj.id, details={"fields": sorted(values)}, ip=ip,
    )
    session.commit()
    return obj


def load(session: Session, spec: Spec, object_id: uuid.UUID) -> Any:
    obj = session.get(spec.model, object_id)
    if obj is None:
        raise NotFound()
    return obj


def update(
    session: Session,
    user: AuthUser,
    spec: Spec,
    object_id: uuid.UUID,
    body: dict[str, Any],
    *,
    ip: str | None,
    prepare: Callable[[Any, dict[str, Any]], None] | None = None,
) -> Any:
    """`body` carries `version` (what the editor saw) plus the changed fields. A stale version → 409."""
    obj = load(session, spec, object_id)
    require(session, user, f"{spec.module}.edit", obj, ip=ip)
    body = dict(body)
    expected = body.pop("version", None)
    if not isinstance(expected, int) or isinstance(expected, bool):
        raise InvalidInput("version_required")
    if spec.create_only & body.keys():
        raise InvalidInput("invalid_input")
    values = parse(spec.patch_model, body)
    for name in values.keys() & spec.non_nullable:
        if values[name] is None:
            raise InvalidInput("invalid_input")
    for name in spec.text_required:
        if name in values and not filled(values[name]):
            raise InvalidInput("required_field")
    check_year_range(values, obj)
    before = {name: to_json(getattr(obj, name)) for name in values}
    if prepare is not None:
        prepare(obj, values)
    changed = {name: value for name, value in values.items() if before[name] != to_json(value)}
    if not changed:
        return obj
    try:
        workflow.save_with_version(session, user, spec.kind, obj, expected, values)
        audit.record(
            session, action_type=f"{spec.kind}.update", result=AuditResult.SUCCESS, user=user,
            object_type=spec.kind, object_id=obj.id, details={"fields": sorted(changed)}, ip=ip,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise conflict_from(exc) from exc
    except Conflict:
        session.rollback()
        raise
    return obj


def delete(
    session: Session,
    user: AuthUser,
    spec: Spec,
    object_id: uuid.UUID,
    *,
    ip: str | None,
    blockers: Callable[[Any], str | None],
) -> None:
    """Drafts and archived objects only, and only without children or files (`blockers` names the reason)."""
    obj = load(session, spec, object_id)
    require(session, user, f"{spec.module}.delete", obj, ip=ip)
    if obj.workflow_status not in DELETABLE:
        raise Conflict("not_deletable")
    reason = blockers(obj)
    if reason is not None:
        raise Conflict(reason)
    audit.record(
        session, action_type=f"{spec.kind}.delete", result=AuditResult.SUCCESS, user=user,
        object_type=spec.kind, object_id=obj.id, details={"status": obj.workflow_status.value}, ip=ip,
    )
    indexing.remove_object(session, spec.kind, obj.id)
    session.delete(obj)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise Conflict("has_children") from exc


def present(
    user: AuthUser,
    spec: Spec,
    obj: Any,
    *,
    path: list[tuple[str, Any, str]] | None = None,
    counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Dict for ObjectOut: the editable fields plus state; never paths of stored files."""
    return {
        "id": obj.id,
        "kind": spec.kind,
        "version": obj.version,
        "workflow_status": obj.workflow_status.value,
        "translation_status": obj.translation_status or {},
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "available_actions": workflow.available_actions(user, spec.kind, obj),
        "values": {name: to_json(getattr(obj, name)) for name in spec.input_model.model_fields},
        "path": [{"kind": kind, "id": ident, "label": label} for kind, ident, label in path or []],
        "counts": counts or {},
    }
