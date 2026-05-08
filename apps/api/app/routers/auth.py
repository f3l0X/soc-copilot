import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.config import get_settings
from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.middleware.ratelimit import auth_rate_limit
from app.models import User, UserRole
from app.schemas.auth import (
    LLMSettingsResponse,
    LLMSettingsUpdate,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UpdateProfileRequest,
    UserMe,
)
from app.services.auth import hash_password, issue_token, verify_password
from app.services.llm import GeminiAdapter, LLMProviderError
from app.services.secrets import EncryptionDisabled, encrypt, last4

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.cookie_name,
        value=token,
        httponly=True,
        secure=s.effective_cookie_secure,
        samesite=s.effective_cookie_samesite,
        max_age=s.jwt_ttl_seconds,
        path="/",
    )


@router.post(
    "/register",
    response_model=UserMe,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limit)],
)
def register(payload: RegisterRequest, db: DbSession) -> User:
    """Bootstrap or invitation-style registration.

    The very first user to register becomes ADMIN; everyone after is an
    ANALYST. Once at least one user exists, public registration is
    rejected unless ``ALLOW_PUBLIC_REGISTRATION=true`` — admin-only
    invites are the secure default after bootstrap.
    """
    settings = get_settings()
    is_first = db.scalar(select(User).limit(1)) is None

    # After bootstrap, gate self-service registration behind a flag so an
    # unauthenticated attacker can't quietly create analyst accounts.
    if not is_first and not settings.allow_public_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="public registration is disabled",
        )

    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        )

    user = User(
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(payload.password),
        role=UserRole.ADMIN if is_first else UserRole.ANALYST,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(
        "auth.register",
        extra={
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_first": is_first,
        },
    )
    return user


@router.post(
    "/login",
    response_model=LoginResponse,
    dependencies=[Depends(auth_rate_limit)],
)
def login(payload: LoginRequest, db: DbSession, response: Response, request: Request) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))

    if user is None:
        hash_password(payload.password)
        valid_password = False
    else:
        valid_password = verify_password(payload.password, user.hashed_password)

    if not valid_password:
        ip = request.client.host if request.client else None
        logger.info(
            "auth.login",
            extra={
                "user_id": user.id if user else None,
                "email": payload.email,
                "success": False,
                "ip": ip,
            },
        )
        # Don't leak which step failed.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials"
        )

    token, exp = issue_token(
        user_id=user.id, role=user.role.value, password_version=user.password_version
    )
    _set_session_cookie(response, token)
    ip = request.client.host if request.client else None
    logger.info(
        "auth.login",
        extra={
            "user_id": user.id,
            "email": user.email,
            "success": True,
            "ip": ip,
        },
    )
    return LoginResponse(user=UserMe.model_validate(user), expires_at=exp)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response) -> None:
    s = get_settings()
    response.delete_cookie(key=s.cookie_name, path="/")
    # Best-effort identify the user for the audit trail; logout never fails
    # auth even if the cookie is missing or stale.
    user_id: int | None = None
    cookie = request.cookies.get(s.cookie_name)
    if cookie:
        try:
            from app.services.auth import decode_token

            payload = decode_token(cookie)
            user_id = int(payload.get("sub")) if payload.get("sub") else None
        except Exception:
            user_id = None
    logger.info("auth.logout", extra={"user_id": user_id})


@router.get("/me", response_model=UserMe)
def me(user: CurrentUser) -> UserMe:
    return UserMe.model_validate(user)


@router.put("/me", response_model=UserMe)
def update_me(
    payload: UpdateProfileRequest, user: CurrentUser, db: DbSession
) -> UserMe:
    """Allow any authenticated user to edit their own profile fields.

    Email change requires the current password (defence against session
    hijack) and a uniqueness check. Role and password are out of scope
    here.
    """
    email_changing = (
        payload.email is not None and payload.email != user.email
    )
    if email_changing:
        if not payload.current_password or not verify_password(
            payload.current_password, user.hashed_password
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="current password required to change email",
            )
        clash = db.scalar(select(User).where(User.email == payload.email))
        if clash and clash.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="email already in use"
            )
        user.email = payload.email
    if payload.name is not None:
        user.name = payload.name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    db.commit()
    db.refresh(user)
    return UserMe.model_validate(user)


# ── Per-user LLM configuration (BYO Gemini key + preferred model) ───────


def _llm_settings_response(user: User) -> LLMSettingsResponse:
    s = get_settings()
    return LLMSettingsResponse(
        configured=user.gemini_api_key_ciphertext is not None,
        key_last4=user.gemini_key_last4,
        key_validated_at=user.gemini_key_validated_at,
        preferred_chat_model=user.preferred_chat_model,
        available_models=s.chat_models_list,
        default_model=s.gemini_chat_model,
        server_quota_used=user.server_llm_calls_today
        if user.server_llm_quota_date
        and user.server_llm_quota_date == _utc_today()
        else 0,
        server_quota_limit=s.server_llm_daily_quota,
    )


def _utc_today():
    from datetime import UTC, datetime

    return datetime.now(UTC).date()


@router.get("/me/llm", response_model=LLMSettingsResponse)
def get_llm_settings(user: CurrentUser) -> LLMSettingsResponse:
    return _llm_settings_response(user)


@router.put("/me/llm", response_model=LLMSettingsResponse)
def update_llm_settings(
    payload: LLMSettingsUpdate, user: CurrentUser, db: DbSession
) -> LLMSettingsResponse:
    """Set or update the user's BYO key and/or preferred model.

    A new ``api_key`` is validated against Gemini (a tiny generate call)
    BEFORE being persisted, so the user can't save junk and get cryptic
    errors later. Validation failures bubble up as 400/502.
    """
    settings = get_settings()

    # Model preference — must live inside the server allowlist.
    if payload.preferred_chat_model is not None:
        if payload.preferred_chat_model not in settings.chat_models_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="model not in allowlist",
            )
        user.preferred_chat_model = payload.preferred_chat_model

    # API key — encrypt + store only after a live ping succeeds.
    if payload.api_key is not None:
        api_key = payload.api_key.strip()
        # Cheap shape check: Google AI Studio keys start with "AIza" and
        # are ~39 chars. Don't be too strict (Google may rotate the
        # format) but reject obvious garbage.
        if len(api_key) < 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="api_key looks too short to be a Gemini key",
            )
        try:
            probe = GeminiAdapter(api_key=api_key)
            # Tiny round-trip — 1-token generation is enough to confirm
            # auth works without burning quota.
            probe.generate_text("ping", temperature=0.0)
        except LLMProviderError as exc:
            logger.warning(
                "auth.byo_key_validation_failed",
                extra={"user_id": user.id, "reason": str(exc)},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gemini rejected this key — check the value",
            ) from None
        try:
            user.gemini_api_key_ciphertext = encrypt(api_key)
        except EncryptionDisabled as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from None
        user.gemini_key_last4 = last4(api_key)
        from datetime import UTC
        from datetime import datetime as _dt

        user.gemini_key_validated_at = _dt.now(UTC)

    db.commit()
    db.refresh(user)
    logger.info(
        "auth.llm_settings_updated",
        extra={
            "user_id": user.id,
            "key_changed": payload.api_key is not None,
            "preferred_chat_model": user.preferred_chat_model,
        },
    )
    return _llm_settings_response(user)


@router.delete("/me/llm", response_model=LLMSettingsResponse)
def clear_llm_key(user: CurrentUser, db: DbSession) -> LLMSettingsResponse:
    """Drop the BYO key. The user goes back to the shared server key
    (subject to the daily quota). Preferred model is preserved."""
    user.gemini_api_key_ciphertext = None
    user.gemini_key_last4 = None
    user.gemini_key_validated_at = None
    db.commit()
    db.refresh(user)
    logger.info("auth.llm_key_cleared", extra={"user_id": user.id})
    return _llm_settings_response(user)
