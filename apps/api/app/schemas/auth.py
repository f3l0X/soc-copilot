from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import UserRole


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str
    email: str
    role: UserRole
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    # Required only when changing email — protects against session-theft
    # account hijack. Validated server-side; ignored otherwise.
    current_password: str | None = Field(None, min_length=1, max_length=128)


class LoginResponse(BaseModel):
    user: UserMe
    expires_at: datetime


class LLMSettingsResponse(BaseModel):
    """What the frontend may know about a user's LLM configuration.

    The encrypted key itself is NEVER returned. The UI surfaces "configured
    or not" plus the last 4 chars to give the user a fingerprint they can
    visually verify.
    """

    configured: bool
    key_last4: str | None = None
    key_validated_at: datetime | None = None
    preferred_chat_model: str | None = None
    available_models: list[str]
    default_model: str
    # Daily quota status — only meaningful when ``configured`` is False.
    server_quota_used: int
    server_quota_limit: int


class LLMSettingsUpdate(BaseModel):
    """Partial update. ``api_key`` resets the BYO key; ``preferred_chat_model``
    sets the per-user default. Either, both, or neither can appear.
    """

    api_key: str | None = Field(None, min_length=10, max_length=256)
    preferred_chat_model: str | None = Field(None, min_length=1, max_length=64)
