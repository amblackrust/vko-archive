from fastapi import APIRouter

from app.deps import ClientIp, CurrentUser, DbSession
from app.models import Role
from app.schemas.authz import PermissionOut, RoleMatrixResponse, RoleOut, RolePermissionsUpdate
from app.services import authz

router = APIRouter(prefix="/roles", tags=["admin: roles"])


def _role(role: Role) -> RoleOut:
    return RoleOut(
        id=role.id,
        code=role.code,
        name=role.name,
        is_system=role.is_system,
        permissions=sorted(f"{p.module}.{p.action}" for p in role.permissions),
    )


@router.get("", response_model=RoleMatrixResponse)
def role_matrix(user: CurrentUser, session: DbSession, ip: ClientIp) -> RoleMatrixResponse:
    roles, permissions = authz.role_matrix(session, user, ip=ip)
    return RoleMatrixResponse(
        roles=[_role(role) for role in roles],
        permissions=[
            PermissionOut(key=f"{p.module}.{p.action}", module=p.module, action=p.action)
            for p in permissions
        ],
    )


@router.put("/{code}/permissions", response_model=RoleOut)
def update_role_permissions(
    code: str, body: RolePermissionsUpdate, user: CurrentUser, session: DbSession, ip: ClientIp
) -> RoleOut:
    return _role(authz.set_role_permissions(session, user, code, body.permissions, ip=ip))
