from fastapi import APIRouter, Response, status

from app.deps import AppSettings, ClientIp, CurrentSession, DbSession, clear_session_cookies, set_session_cookies
from app.schemas.auth import LoginRequest, MeResponse, PasswordChangeRequest
from app.services import auth as auth_service
from app.services.auth import AuthSession

router = APIRouter(prefix="/auth", tags=["admin: auth"])


def _me(auth: AuthSession) -> MeResponse:
    user = auth.user
    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        branch_id=user.branch_id,
        roles=sorted(user.roles),
        permissions=sorted(user.permissions),
        is_super=user.is_super,
        branch_scoped=user.branch_scoped,
        csrf_token=auth.csrf,
    )


@router.post("/login", response_model=MeResponse)
def login(body: LoginRequest, response: Response, session: DbSession, settings: AppSettings, ip: ClientIp) -> MeResponse:
    auth = auth_service.login(session, settings, body.email, body.password, ip=ip)
    set_session_cookies(response, settings, auth)
    return _me(auth)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(auth: CurrentSession, session: DbSession, settings: AppSettings, ip: ClientIp) -> Response:
    auth_service.logout(session, auth.user, ip=ip)
    # A fresh Response: the renewed cookies set by the session dependency are not merged into it.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookies(response, settings)
    return response


@router.get("/me", response_model=MeResponse)
def me(auth: CurrentSession) -> MeResponse:
    return _me(auth)


@router.post("/password", response_model=MeResponse)
def change_password(
    body: PasswordChangeRequest,
    auth: CurrentSession,
    response: Response,
    session: DbSession,
    settings: AppSettings,
    ip: ClientIp,
) -> MeResponse:
    renewed = auth_service.change_password(session, settings, auth, body.current_password, body.new_password, ip=ip)
    set_session_cookies(response, settings, renewed)
    return _me(renewed)
