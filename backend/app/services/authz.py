"""Roles and permissions (T6.2, the project plan §5).

Every admin endpoint goes through `authorize(user, action, obj)` (or `require()`, which
also writes a "denied" entry to the journal and raises). Actions are "module.action"
strings; the role -> permission matrix lives in the DB (roles, permissions,
role_permissions) and is edited by the super admin. Hiding menu items in the UI is
cosmetic only: the check here is what counts.

Branch scope: a user whose roles are all branch-scoped (branch admin, or an archivist
bound to a branch) may act only on objects of their own branch. The branch of a catalog
object is derived from the hierarchy case -> inventory -> fund.branch_id.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models import Branch, Case, DigitalFile, Document, Fund, Inventory, Permission, Role, User
from app.models.enums import AuditResult, DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from app.repositories import roles as roles_repo
from app.repositories import users as users_repo
from app.services import audit
from app.services.errors import InvalidInput, NotFound, PermissionDenied

# module -> actions. Adding a permission = a new entry here + `ensure_roles_and_permissions`.
PERMISSIONS: dict[str, tuple[str, ...]] = {
    "catalog": ("view", "create", "edit", "delete", "import", "export"),
    "files": ("view", "upload", "delete"),
    "content": ("view", "create", "edit", "delete"),
    "branches": ("view", "create", "edit", "delete"),
    "users": ("view", "manage"),
    "settings": ("edit",),
    "audit": ("view", "export"),
    "workflow": ("submit", "review", "publish", "archive"),
    "ai": ("use",),
    "analytics": ("view",),
}
ALL_PERMISSIONS = frozenset(f"{module}.{action}" for module, actions in PERMISSIONS.items() for action in actions)

# Not in the editable matrix: only the super admin may edit roles/permissions, so nobody
# can lock the super admin out or grant themselves the matrix.
SUPER_ONLY_ACTIONS = frozenset({"roles.manage"})
# Public action with its own rule (docs/DECISIONS.md п.14).
FILE_DOWNLOAD = "file.download"
# Granting/revoking a role (obj = RoleChange). Not in the matrix: derived from users.manage
# plus the anti-escalation rules in authorize().
USERS_ASSIGN_ROLE = "users.assign_role"

BRANCH_SCOPED_ROLES = frozenset({RoleCode.BRANCH_ADMIN.value, RoleCode.ARCHIVIST.value})

ROLE_NAMES: dict[RoleCode, dict[str, str]] = {
    RoleCode.SUPER_ADMIN: {"kk": "Бас әкімші", "ru": "Главный администратор", "en": "Super administrator"},
    RoleCode.SITE_ADMIN: {"kk": "Сайт әкімшісі", "ru": "Администратор сайта", "en": "Site administrator"},
    RoleCode.EDITOR: {"kk": "Редактор", "ru": "Редактор", "en": "Editor"},
    RoleCode.ARCHIVIST: {"kk": "Архив қызметкері", "ru": "Сотрудник архива", "en": "Archivist"},
    RoleCode.BRANCH_ADMIN: {"kk": "Филиал әкімшісі", "ru": "Администратор филиала", "en": "Branch administrator"},
    RoleCode.MODERATOR: {"kk": "Модератор", "ru": "Модератор", "en": "Moderator"},
    RoleCode.ANALYST: {"kk": "Талдаушы", "ru": "Аналитик", "en": "Analyst"},
}

# Default matrix, applied only when a role is first created (later edits are kept).
# The super admin bypasses the matrix and has no rows here.
DEFAULT_ROLE_PERMISSIONS: dict[RoleCode, frozenset[str]] = {
    RoleCode.SUPER_ADMIN: frozenset(),
    RoleCode.SITE_ADMIN: frozenset(
        {
            "content.view", "content.create", "content.edit", "content.delete",
            "users.view", "users.manage", "settings.edit",
            "branches.view", "branches.create", "branches.edit",
            "catalog.view", "files.view", "files.upload", "workflow.submit", "analytics.view",
        }
    ),
    RoleCode.EDITOR: frozenset(
        {
            "content.view", "content.create", "content.edit",
            "catalog.view", "catalog.create", "catalog.edit",
            "files.view", "files.upload", "workflow.submit", "ai.use",
        }
    ),
    RoleCode.ARCHIVIST: frozenset(
        {
            "catalog.view", "catalog.create", "catalog.edit", "catalog.import", "catalog.export",
            "files.view", "files.upload", "files.delete", "workflow.submit", "ai.use",
        }
    ),
    RoleCode.BRANCH_ADMIN: frozenset(
        {
            "branches.view", "branches.edit",
            "catalog.view", "catalog.create", "catalog.edit",
            "files.view", "files.upload", "workflow.submit",
        }
    ),
    RoleCode.MODERATOR: frozenset(
        {
            "content.view", "catalog.view", "branches.view", "files.view",
            "workflow.review", "workflow.publish", "workflow.archive",
        }
    ),
    RoleCode.ANALYST: frozenset({"analytics.view"}),
}


@dataclass(frozen=True)
class AuthUser:
    """The authenticated staff user with roles and permissions resolved for this request."""

    id: uuid.UUID
    email: str
    full_name: str
    branch_id: uuid.UUID | None
    roles: frozenset[str]
    permissions: frozenset[str]

    @property
    def is_super(self) -> bool:
        return RoleCode.SUPER_ADMIN.value in self.roles

    @property
    def branch_scoped(self) -> bool:
        if not self.roles or not self.roles <= BRANCH_SCOPED_ROLES:
            return False
        # An archivist without a branch works for the whole archive; a branch admin never does.
        return self.branch_id is not None or RoleCode.BRANCH_ADMIN.value in self.roles


@dataclass(frozen=True)
class FileTarget:
    """Object for the "file.download" check. The caller loads the owner: `document` when
    owner_type == "document", otherwise `owner_published` says whether the owner
    (exhibit, news, ...) is published."""

    file: DigitalFile
    document: Document | None = None
    owner_published: bool = False


@dataclass(frozen=True)
class RoleChange:
    """Object for the "users.assign_role" check: `role` is granted to or revoked from `target`."""

    target: User
    role: Role


def load_auth_user(session: Session, user: User) -> AuthUser:
    return AuthUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        branch_id=user.branch_id,
        roles=frozenset(users_repo.role_codes(session, user.id)),
        permissions=frozenset(users_repo.permission_keys(session, user.id)),
    )


def document_branch_id(document: Document) -> uuid.UUID | None:
    """Branch of a document: from case -> inventory -> fund when it is placed in the
    hierarchy (authoritative), otherwise its own branch_id."""
    if document.case is not None:
        return document.case.inventory.fund.branch_id
    return document.branch_id


def sync_document_branch(document: Document) -> None:
    """Call before saving a document: keeps documents.branch_id equal to the hierarchy's."""
    if document.case is not None:
        document.branch_id = document.case.inventory.fund.branch_id


def object_branch_id(obj: Any) -> uuid.UUID | None:
    if isinstance(obj, Branch):
        return obj.id
    if isinstance(obj, Fund):
        return obj.branch_id
    if isinstance(obj, Inventory):
        return obj.fund.branch_id
    if isinstance(obj, Case):
        return obj.inventory.fund.branch_id
    if isinstance(obj, Document):
        return document_branch_id(obj)
    if isinstance(obj, FileTarget):
        return document_branch_id(obj.document) if obj.document is not None else None
    if isinstance(obj, RoleChange):
        return obj.target.branch_id
    return getattr(obj, "branch_id", None)


def _document_is_public(document: Document) -> bool:
    return (
        document.workflow_status == WorkflowStatus.PUBLISHED
        and document.description_status == DescriptionStatus.PUBLIC
        and document.file_access == FileAccess.OPEN
    )


def _can_download(user: AuthUser | None, target: Any) -> bool:
    if not isinstance(target, FileTarget):
        return False
    file = target.file
    if file.owner_type == "document":
        if target.document is None or target.document.id != file.owner_id:
            return False
    elif file.owner_type is None:
        return False
    # Staff with file access see restricted/closed files (reading room), within their branch.
    if user is not None and (user.is_super or "files.view" in user.permissions):
        if not user.branch_scoped or object_branch_id(target) == user.branch_id:
            return True
    if file.access != FileAccess.OPEN:
        return False
    if target.document is not None:
        return _document_is_public(target.document)
    return target.owner_published


def _is_super_admin(target: User) -> bool:
    return any(role.code == RoleCode.SUPER_ADMIN.value for role in target.roles)


def _target_user(obj: Any) -> User | None:
    if isinstance(obj, RoleChange):
        return obj.target
    return obj if isinstance(obj, User) else None


def authorize(user: AuthUser | None, action: str, obj: Any = None) -> bool:
    """True if `user` (None = anonymous visitor) may perform `action` on `obj`.
    With obj=None only the permission itself is checked (lists, create forms);
    list queries of branch-scoped users must additionally filter by `user.branch_id`."""
    if action == FILE_DOWNLOAD:
        return _can_download(user, obj)
    if user is None:
        return False
    target = _target_user(obj) if action.startswith("users.") else None
    # Nobody changes their own roles or status (block/deactivate), not even the super admin:
    # a super admin could otherwise lock the archive out of its last super account.
    if action in (USERS_ASSIGN_ROLE, "users.manage") and target is not None and target.id == user.id:
        return False
    if action == USERS_ASSIGN_ROLE and not isinstance(obj, RoleChange):
        return False
    if user.is_super:
        return True
    if action == USERS_ASSIGN_ROLE:
        # Escalation guard: only the super admin grants or revokes super_admin.
        if obj.role.code == RoleCode.SUPER_ADMIN.value:
            return False
        action = "users.manage"
    if action in SUPER_ONLY_ACTIONS or action not in user.permissions:
        return False
    # Site admins manage users except super admins (§5).
    if target is not None and _is_super_admin(target):
        return False
    if obj is not None and user.branch_scoped:
        return user.branch_id is not None and object_branch_id(obj) == user.branch_id
    return True


def require(session: Session, user: AuthUser | None, action: str, obj: Any = None, *, ip: str | None = None) -> None:
    """authorize() or raise. A denial is journaled in its own commit (the request's
    pending changes are rolled back first: the request fails anyway).
    file.download raises NotFound, so a hidden file is indistinguishable from a missing one."""
    if authorize(user, action, obj):
        return
    if action == FILE_DOWNLOAD and user is None:
        # Anonymous misses on public files are routine (dead links, crawlers): not journaled.
        raise NotFound()
    target = obj.file if isinstance(obj, FileTarget) else obj.target if isinstance(obj, RoleChange) else obj
    session.rollback()
    audit.record(
        session,
        action_type=action,
        result=AuditResult.DENIED,
        user=user,
        object_type=target.__tablename__ if hasattr(target, "__tablename__") else None,
        object_id=getattr(target, "id", None),
        ip=ip,
    )
    session.commit()
    if action == FILE_DOWNLOAD:
        raise NotFound()
    raise PermissionDenied()


def ensure_roles_and_permissions(session: Session) -> None:
    """Idempotent: creates missing permissions and the 7 system roles (a new role gets
    its default permissions; existing roles keep their edited matrix). Does not commit."""
    existing = {(p.module, p.action): p for p in roles_repo.list_permissions(session)}
    for module, actions in PERMISSIONS.items():
        for action in actions:
            if (module, action) not in existing:
                permission = Permission(module=module, action=action)
                session.add(permission)
                existing[(module, action)] = permission
    roles = {role.code: role for role in roles_repo.list_roles(session)}
    for code in RoleCode:
        if code.value in roles:
            continue
        defaults = DEFAULT_ROLE_PERMISSIONS[code]
        session.add(
            Role(
                code=code.value,
                name=ROLE_NAMES[code],
                is_system=True,
                permissions=[existing[tuple(key.split(".", 1))] for key in sorted(defaults)],
            )
        )
    session.flush()


def role_matrix(session: Session, user: AuthUser, *, ip: str | None) -> tuple[list[Role], list[Permission]]:
    require(session, user, "roles.manage", ip=ip)
    return roles_repo.list_roles(session), roles_repo.list_permissions(session)


def set_role_permissions(
    session: Session, user: AuthUser, role_code: str, permission_keys: list[str], *, ip: str | None
) -> Role:
    """Replaces a role's permission set (super admin only) and journals the change."""
    require(session, user, "roles.manage", ip=ip)
    role = roles_repo.get_role(session, role_code)
    if role is None:
        raise NotFound()
    if role.code == RoleCode.SUPER_ADMIN.value:
        raise InvalidInput("super_admin_has_all_permissions")
    wanted = set(permission_keys)
    unknown = wanted - ALL_PERMISSIONS
    if unknown:
        raise InvalidInput("unknown_permission")
    ensure_roles_and_permissions(session)
    by_key = {f"{p.module}.{p.action}": p for p in roles_repo.list_permissions(session)}
    before = {f"{p.module}.{p.action}" for p in role.permissions}
    role.permissions = [by_key[key] for key in sorted(wanted)]
    audit.record(
        session,
        action_type="permissions.change",
        result=AuditResult.SUCCESS,
        user=user,
        object_type="role",
        object_id=role.id,
        details={"role": role.code, "added": sorted(wanted - before), "removed": sorted(before - wanted)},
        ip=ip,
    )
    session.commit()
    return role
