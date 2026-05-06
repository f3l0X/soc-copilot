"""Auth primitives: password hashing + stateless JWT tokens.

JWT is signed with HS256 using `settings.jwt_secret`. Cookie storage is
managed by the router (httpOnly + SameSite=Lax). Tokens carry minimal
claims: subject (user id), role, exp.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import get_settings

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except ValueError:
        return False


def issue_token(
    *, user_id: int, role: str, password_version: int
) -> tuple[str, datetime]:
    s = get_settings()
    now = datetime.now(UTC)
    exp = now + timedelta(seconds=s.jwt_ttl_seconds)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "pv": password_version,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_alg)
    return token, exp


class TokenError(Exception):
    pass


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_alg])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("invalid token") from exc
