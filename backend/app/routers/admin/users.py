import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.models import User
from app.schemas.users import BranchOption, UserCreate, UserOut, UserPage, UserPasswordReset, UserRolesUpdate, UserUpdate
from app.services import users

router = APIRouter(prefix="/users", tags=["admin: users"])


def _out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        branch_id=user.branch_id,
        roles=sorted(role.code for role in user.roles),
        is_active=user.is_active,
        is_locked=users.is_locked(user),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


@router.get("", response_model=UserPage)
def list_users(
    actor: CurrentUser,
    session: DbSession,
    ip: ClientIp,
    q: Annotated[str | None, Query(max_length=200)] = None,
    role: Annotated[str | None, Query(max_length=64)] = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> UserPage:
    rows, total = users.search(
        session, actor, q=q, role=role, is_active=is_active, page=page, page_size=page_size, ip=ip
    )
    return UserPage(items=[_out(u) for u in rows], total=total, page=page, page_size=page_size)


@router.get("/branch-options", response_model=list[BranchOption])
def branch_options(actor: CurrentUser, session: DbSession, ip: ClientIp) -> list[BranchOption]:
    return [BranchOption(id=b.id, name=b.name) for b in users.branch_options(session, actor, ip=ip)]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, actor: CurrentUser, session: DbSession, ip: ClientIp) -> UserOut:
    return _out(users.create(session, actor, body, ip=ip))


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, actor: CurrentUser, session: DbSession, ip: ClientIp) -> UserOut:
    return _out(users.get(session, actor, user_id, ip=ip))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, actor: CurrentUser, session: DbSession, ip: ClientIp) -> UserOut:
    return _out(users.update(session, actor, user_id, body, ip=ip))


@router.put("/{user_id}/roles", response_model=UserOut)
def set_user_roles(
    user_id: uuid.UUID, body: UserRolesUpdate, actor: CurrentUser, session: DbSession, ip: ClientIp
) -> UserOut:
    return _out(users.set_roles(session, actor, user_id, body.roles, ip=ip))


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: uuid.UUID, body: UserPasswordReset, actor: CurrentUser, session: DbSession, ip: ClientIp
) -> Response:
    users.reset_password(session, actor, user_id, body.new_password, ip=ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
