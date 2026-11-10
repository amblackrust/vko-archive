"""Staff user management (T6.4).

Every mutation goes through authz.require(): `users.manage` on the target user and
`users.assign_role` (RoleChange) for each role granted or revoked, so a site admin cannot
create or promote a super admin and nobody edits their own roles or status. Users are
never deleted (the journal references them): "block" = is_active False. Passwords and
hashes never reach the journal.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import security
from app.models import Branch, Role, User
from app.models.enums import AuditResult, RoleCode
from app.repositories import roles as roles_repo
from app.repositories import users as users_repo
from app.services import audit, authz
from app.services.auth import normalize_email, validate_new_password
from app.services.authz import AuthUser, RoleChange
from app.services.errors import Conflict, InvalidInput, NotFound
from app.schemas.users import UserCreate, UserUpdate


def _load(session: Session, user_id: uuid.UUID, *, for_update: bool = False) -> User:
    target = users_repo.get_by_id(session, user_id, for_update=for_update)
    if target is None:
        raise NotFound()
    return target


def _roles(session: Session, codes: list[str]) -> list[Role]:
    unique = list(dict.fromkeys(codes))
    found = [roles_repo.get_role(session, code) for code in unique]
    if any(role is None for role in found):
        raise InvalidInput("unknown_role")
    return found  # type: ignore[return-value]


def _check_branch(session: Session, branch_id: uuid.UUID | None, roles: list[Role]) -> None:
    if branch_id is not None and session.get(Branch, branch_id) is None:
        raise InvalidInput("unknown_branch")
    if branch_id is None and any(role.code == RoleCode.BRANCH_ADMIN.value for role in roles):
        raise InvalidInput("branch_required")


def is_locked(user: User) -> bool:
    return user.locked_until is not None and user.locked_until > datetime.now(UTC)


def search(
    session: Session,
    actor: AuthUser,
    *,
    q: str | None,
    role: str | None,
    is_active: bool | None,
    page: int,
    page_size: int,
    ip: str | None,
) -> tuple[list[User], int]:
    authz.require(session, actor, "users.view", ip=ip)
    return users_repo.search(
        session,
        q=q,
        role=role,
        is_active=is_active,
        # A branch-scoped manager sees only their branch; only super admins see super admins.
        branch_id=actor.branch_id if actor.branch_scoped else None,
        hide_super_admins=not actor.is_super,
        offset=(page - 1) * page_size,
        limit=page_size,
    )


def get(session: Session, actor: AuthUser, user_id: uuid.UUID, *, ip: str | None) -> User:
    target = _load(session, user_id)
    authz.require(session, actor, "users.view", target, ip=ip)
    return target


def create(session: Session, actor: AuthUser, body: UserCreate, *, ip: str | None) -> User:
    email = normalize_email(body.email)
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise InvalidInput("invalid_email")
    validate_new_password(body.password)
    roles = _roles(session, body.roles)
    _check_branch(session, body.branch_id, roles)
    target = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=security.hash_password(body.password),
        full_name=body.full_name.strip(),
        branch_id=body.branch_id,
        password_changed_at=datetime.now(UTC),
    )
    authz.require(session, actor, "users.manage", target, ip=ip)
    for role in roles:
        authz.require(session, actor, authz.USERS_ASSIGN_ROLE, RoleChange(target, role), ip=ip)
    if users_repo.get_by_email(session, email) is not None:
        raise Conflict("email_taken")
    target.roles = roles
    session.add(target)
    audit.record(
        session, action_type="users.create", result=AuditResult.SUCCESS, user=actor, object_type="user",
        object_id=target.id, details={"email": email, "roles": [r.code for r in roles], "branch_id": body.branch_id}, ip=ip,
    )
    _commit(session)
    return target


def update(session: Session, actor: AuthUser, user_id: uuid.UUID, body: UserUpdate, *, ip: str | None) -> User:
    target = _load(session, user_id, for_update=True)
    authz.require(session, actor, "users.manage", target, ip=ip)
    changed = body.model_fields_set
    before: dict[str, object] = {}
    after: dict[str, object] = {}

    def apply(field: str, value: object) -> None:
        if getattr(target, field) != value:
            before[field], after[field] = getattr(target, field), value
            setattr(target, field, value)

    if "email" in changed and body.email is not None:
        email = normalize_email(body.email)
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise InvalidInput("invalid_email")
        existing = users_repo.get_by_email(session, email)
        if existing is not None and existing.id != target.id:
            raise Conflict("email_taken")
        apply("email", email)
    if "full_name" in changed and body.full_name is not None:
        apply("full_name", body.full_name.strip())
    if "branch_id" in changed:
        _check_branch(session, body.branch_id, list(target.roles))
        apply("branch_id", body.branch_id)
    if "is_active" in changed and body.is_active is not None:
        apply("is_active", body.is_active)
        if body.is_active:
            target.failed_logins = 0
            target.locked_until = None
    if not after:
        return target
    # A branch-scoped manager must not move a user out of their own branch (re-check on the new state).
    if "branch_id" in after:
        session.flush()
        authz.require(session, actor, "users.manage", target, ip=ip)
    audit.record(
        session, action_type="users.update", result=AuditResult.SUCCESS, user=actor, object_type="user",
        object_id=target.id, details={"before": before, "after": after}, ip=ip,
    )
    _commit(session)
    return target


def set_roles(session: Session, actor: AuthUser, user_id: uuid.UUID, codes: list[str], *, ip: str | None) -> User:
    target = _load(session, user_id, for_update=True)
    authz.require(session, actor, "users.manage", target, ip=ip)
    wanted = _roles(session, codes)
    _check_branch(session, target.branch_id, wanted)
    current = {role.code: role for role in target.roles}
    wanted_by_code = {role.code: role for role in wanted}
    added = [role for code, role in wanted_by_code.items() if code not in current]
    removed = [role for code, role in current.items() if code not in wanted_by_code]
    for role in (*added, *removed):
        authz.require(session, actor, authz.USERS_ASSIGN_ROLE, RoleChange(target, role), ip=ip)
    if not added and not removed:
        return target
    target.roles = wanted
    audit.record(
        session, action_type="users.roles", result=AuditResult.SUCCESS, user=actor, object_type="user",
        object_id=target.id, details={"added": [r.code for r in added], "removed": [r.code for r in removed]}, ip=ip,
    )
    _commit(session)
    return target


def reset_password(session: Session, actor: AuthUser, user_id: uuid.UUID, new_password: str, *, ip: str | None) -> None:
    """Sets a new password; the user's open sessions stop working (password_changed_at moves)."""
    target = _load(session, user_id, for_update=True)
    authz.require(session, actor, "users.manage", target, ip=ip)
    validate_new_password(new_password)
    target.password_hash = security.hash_password(new_password)
    target.password_changed_at = datetime.now(UTC)
    target.failed_logins = 0
    target.locked_until = None
    audit.record(
        session, action_type="users.password_reset", result=AuditResult.SUCCESS, user=actor, object_type="user",
        object_id=target.id, ip=ip,
    )
    session.commit()


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise Conflict("email_taken") from exc


def branch_options(session: Session, actor: AuthUser, *, ip: str | None) -> list[Branch]:
    """Branches for the user form's selector (a branch-scoped manager gets only their own)."""
    authz.require(session, actor, "users.view", ip=ip)
    stmt = select(Branch).order_by(Branch.position, Branch.slug)
    if actor.branch_scoped:
        stmt = stmt.where(Branch.id == actor.branch_id)
    return list(session.scalars(stmt))
