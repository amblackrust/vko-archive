import uuid

from pydantic import BaseModel, Field


class PermissionOut(BaseModel):
    key: str  # "module.action"
    module: str
    action: str


class RoleOut(BaseModel):
    id: uuid.UUID
    code: str
    name: dict[str, str]
    is_system: bool
    permissions: list[str]


class RoleMatrixResponse(BaseModel):
    roles: list[RoleOut]
    permissions: list[PermissionOut]


class RolePermissionsUpdate(BaseModel):
    permissions: list[str] = Field(max_length=200)
