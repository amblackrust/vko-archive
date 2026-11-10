import uuid

from pydantic import BaseModel, Field

from app.security import PASSWORD_MAX_LENGTH


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    branch_id: uuid.UUID | None
    roles: list[str]
    permissions: list[str]
    is_super: bool
    branch_scoped: bool
    # Echo in the X-CSRF-Token header on POST/PUT/PATCH/DELETE (also set as the vko_csrf cookie).
    csrf_token: str
