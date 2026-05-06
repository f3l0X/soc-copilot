from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import UserRole


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangeRoleRequest(BaseModel):
    role: UserRole


class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.ANALYST


class PermissionCell(BaseModel):
    permission_key: str
    area: str
    action: str
    role: UserRole
    allowed: bool
    locked: bool
    default: bool


class PermissionChange(BaseModel):
    role: UserRole
    permission_key: str
    allowed: bool


class UpdatePermissionsRequest(BaseModel):
    changes: list[PermissionChange] = Field(..., min_length=1)


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    actor_id: int | None
    actor_email: str
    action: str
    target_type: str | None
    target_id: int | None
    target_label: str | None
    details: dict[str, Any] | None
    ip: str | None
