import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.security import PASSWORD_MAX_LENGTH


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    branch_id: uuid.UUID | None
    roles: list[str]
    is_active: bool
    is_locked: bool
    last_login_at: datetime | None
    created_at: datetime


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    full_name: str = Field(default="", max_length=255)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    roles: list[str] = Field(min_length=1, max_length=7)
    branch_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    """Only fields present in the request are changed (branch_id: null detaches the branch)."""

    email: str | None = Field(default=None, min_length=3, max_length=320)
    full_name: str | None = Field(default=None, max_length=255)
    branch_id: uuid.UUID | None = None
    is_active: bool | None = None


class UserRolesUpdate(BaseModel):
    roles: list[str] = Field(min_length=1, max_length=7)


class UserPasswordReset(BaseModel):
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class BranchOption(BaseModel):
    id: uuid.UUID
    name: dict[str, str]
