import logging

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, select

from app.db import DbSession
from app.models import AuditLog, User, UserRole
from app.schemas.admin import (
    AuditLogEntry,
    ChangePasswordRequest,
    ChangeRoleRequest,
    CreateUserRequest,
    PermissionCell,
    UpdatePermissionsRequest,
)
from app.schemas.auth import UserMe
from app.services.audit import log_audit
from app.services.auth import hash_password
from app.services.permissions import (
    is_allowed,
    list_effective,
    require_perm,
    set_permission,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def _count_admins(db) -> int:
    return db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.ADMIN)
    ) or 0


@router.get("/users", response_model=list[UserMe])
def list_users(
    db: DbSession,
    user: User = require_perm("users.list"),
) -> list[User]:
    """List all users."""
    return list(db.scalars(select(User).order_by(User.id)))


@router.post("/users", response_model=UserMe, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    db: DbSession,
    request: Request,
    user: User = require_perm("users.create"),
) -> User:
    """Create a user with an explicit role (Admin only)."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        )

    new_user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(new_user)
    db.flush()

    log_audit(
        db,
        actor=user,
        action="user.create",
        target_type="user",
        target_id=new_user.id,
        target_label=new_user.email,
        details={"role": new_user.role.value, "name": new_user.name},
        request=request,
    )
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}/password", status_code=status.HTTP_200_OK)
def change_user_password(
    user_id: int,
    payload: ChangePasswordRequest,
    db: DbSession,
    request: Request,
    user: User = require_perm("users.update_password"),
) -> dict:
    """Change the password of any user (Admin only).

    Bumping `password_version` invalidates every JWT issued before this
    moment for the target user, so a forced reset takes effect immediately
    even on already-logged-in sessions.
    """
    target_user = db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )

    target_user.hashed_password = hash_password(payload.new_password)
    target_user.password_version = (target_user.password_version or 0) + 1

    log_audit(
        db,
        actor=user,
        action="user.password_reset",
        target_type="user",
        target_id=target_user.id,
        target_label=target_user.email,
        request=request,
    )
    db.commit()

    return {"status": "ok", "message": "password updated successfully"}


@router.post("/users/{user_id}/reset-llm-quota", status_code=status.HTTP_200_OK)
def reset_llm_quota(
    user_id: int,
    db: DbSession,
    request: Request,
    user: User = require_perm("users.reset_llm_quota"),
) -> dict:
    """Reset a user's daily quota on the SHARED server LLM key.

    Useful when an analyst gets blocked by the per-day budget and an admin
    decides to grant a fresh allocation (e.g. during an incident drill).
    Doesn't touch BYO keys — only the counter against the shared key.
    """
    target = db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )
    previous = target.server_llm_calls_today
    target.server_llm_calls_today = 0
    # Leave server_llm_quota_date pointing to today so the next call
    # doesn't trigger a "rolled to a new day" reset path.
    log_audit(
        db,
        actor=user,
        action="user.llm_quota_reset",
        target_type="user",
        target_id=target.id,
        target_label=target.email,
        details={"previous_count": previous},
        request=request,
    )
    db.commit()
    return {
        "status": "ok",
        "user_id": target.id,
        "previous_count": previous,
    }


@router.put("/users/{user_id}/role", response_model=UserMe)
def change_user_role(
    user_id: int,
    payload: ChangeRoleRequest,
    db: DbSession,
    request: Request,
    user: User = require_perm("users.update_role"),
) -> User:
    """Change a user's role (Admin only).

    Refuses to demote the last remaining admin and refuses to demote the
    actor themselves. Bumps `password_version` so existing sessions pick up
    the new role on the next request.
    """
    target_user = db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )

    if target_user.role == payload.role:
        return target_user

    demoting_admin = (
        target_user.role == UserRole.ADMIN and payload.role != UserRole.ADMIN
    )
    if demoting_admin:
        if target_user.id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cannot demote yourself",
            )
        if _count_admins(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cannot demote the last admin",
            )

    old_role = target_user.role.value
    target_user.role = payload.role
    target_user.password_version = (target_user.password_version or 0) + 1

    log_audit(
        db,
        actor=user,
        action="user.role_change",
        target_type="user",
        target_id=target_user.id,
        target_label=target_user.email,
        details={"from": old_role, "to": payload.role.value},
        request=request,
    )
    db.commit()
    db.refresh(target_user)
    return target_user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: DbSession,
    request: Request,
    user: User = require_perm("users.delete"),
) -> None:
    """Delete a user (Admin only).

    Refuses to delete the actor themselves or the last remaining admin.
    Owned alerts have `user_id` set NULL via the FK ON DELETE rule.
    """
    target_user = db.scalar(select(User).where(User.id == user_id))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )
    if target_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot delete yourself",
        )
    if target_user.role == UserRole.ADMIN and _count_admins(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot delete the last admin",
        )

    target_email = target_user.email
    target_id = target_user.id
    target_role = target_user.role.value
    db.delete(target_user)

    log_audit(
        db,
        actor=user,
        action="user.delete",
        target_type="user",
        target_id=target_id,
        target_label=target_email,
        details={"role": target_role},
        request=request,
    )
    db.commit()


@router.get("/audit", response_model=list[AuditLogEntry])
def list_audit(
    db: DbSession,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None, description="Filter by exact action verb"),
    actor_email: str | None = Query(
        None, description="Substring match on actor_email"
    ),
    user: User = require_perm("audit.view"),
) -> list[AuditLog]:
    """Return audit log entries, newest first."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if actor_email:
        stmt = stmt.where(AuditLog.actor_email.ilike(f"%{actor_email}%"))
    stmt = stmt.offset(offset).limit(limit)
    return list(db.scalars(stmt))


@router.get("/permissions", response_model=list[PermissionCell])
def get_permissions(
    db: DbSession,
    user: User = require_perm("permissions.manage"),
) -> list[dict]:
    """Return the full role x permission matrix with current effective values."""
    return list_effective(db)


@router.put("/permissions", response_model=list[PermissionCell])
def update_permissions(
    payload: UpdatePermissionsRequest,
    db: DbSession,
    request: Request,
    user: User = require_perm("permissions.manage"),
) -> list[dict]:
    """Bulk-update permission cells. Each item flips one (role, key) bit."""
    changes: list[dict] = []
    for change in payload.changes:
        before = is_allowed(db, change.role, change.permission_key)
        set_permission(db, change.role, change.permission_key, change.allowed)
        if before != change.allowed:
            changes.append(
                {
                    "role": change.role.value,
                    "permission_key": change.permission_key,
                    "from": before,
                    "to": change.allowed,
                }
            )

    if changes:
        log_audit(
            db,
            actor=user,
            action="permissions.update",
            target_type="role_permissions",
            details={"changes": changes},
            request=request,
        )
    db.commit()
    return list_effective(db)
