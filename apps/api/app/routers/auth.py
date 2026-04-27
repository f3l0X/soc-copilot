import logging

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.config import get_settings
from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.models import User, UserRole
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserMe
from app.services.auth import hash_password, issue_token, verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.cookie_name,
        value=token,
        httponly=True,
        secure=s.cookie_secure,
        samesite="lax",
        max_age=s.jwt_ttl_seconds,
        path="/",
    )


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> User:
    """Public registration.

    The very first user to register becomes ADMIN; everyone after is an
    ANALYST. For tighter setups switch to admin-only invites in Phase 5.
    """
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        )

    is_first = db.scalar(select(User).limit(1)) is None
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.ADMIN if is_first else UserRole.ANALYST,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("registered user id=%d role=%s", user.id, user.role.value)
    return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DbSession, response: Response) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        # Don't leak which step failed.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials"
        )

    token, exp = issue_token(user_id=user.id, role=user.role.value)
    _set_session_cookie(response, token)
    return LoginResponse(user=UserMe.model_validate(user), expires_at=exp)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(key=s.cookie_name, path="/")


@router.get("/me", response_model=UserMe)
def me(user: CurrentUser) -> User:
    return user
