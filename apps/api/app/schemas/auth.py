from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import UserLevel, UserRole
from app.services.password import MAX_LENGTH, MIN_LENGTH, check_password
from app.services.security import (
    is_disposable_email,
    normalize_email,
    sanitize_name,
)


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=MIN_LENGTH, max_length=MAX_LENGTH)
    # SOC seniority chosen at registration. ADMIN is bootstrap-only and
    # assigned by the server; users can't ask for it.
    level: UserLevel = UserLevel.L1
    # Honeypot. The UI renders a hidden, off-screen, aria-hidden input
    # named "website" that real users never see. Bots fill every field
    # in the form, so a non-empty value here is a strong bot signal —
    # the router returns a fake-success without touching the DB.
    website: str = Field("", max_length=200)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        cleaned = sanitize_name(v)
        if len(cleaned) < 2:
            raise ValueError("Nombre inválido.")
        return cleaned

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        normalized = normalize_email(v)
        if is_disposable_email(normalized):
            raise ValueError("Dominio de email no permitido.")
        return normalized

    @field_validator("password")
    @classmethod
    def _strong_password(cls, v: str) -> str:
        # Run the same rules the frontend renders so the server-side
        # failure message matches what the user already saw.
        result = check_password(v)
        if not result.ok:
            raise ValueError(result.first_error())
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_email(v)


class UserMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str
    email: str
    role: UserRole
    level: UserLevel
    is_verified: bool
    created_at: datetime


class RegisterResponse(BaseModel):
    """201 payload after register.

    Wraps the user with extra context the UI needs to react: whether
    verification is required, and (DEV-ONLY) the verification link the
    user would have received by email in a real deployment.
    """

    user: UserMe
    verification_required: bool
    verification_link_dev: str | None = None


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


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=64)


class CheckEmailResponse(BaseModel):
    """Used by the real-time availability check on the register form.

    Note: we deliberately accept the enumeration tradeoff here — UX for
    a junior-analyst training tool wins over hiding which emails exist,
    and the login flow still uses opaque "invalid credentials" errors.
    """

    available: bool


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
