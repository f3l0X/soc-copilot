from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.models import Alert, UserRole
from app.schemas.alerts import AlertDetail, AlertSummary

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertSummary])
def list_alerts(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[Alert]:
    stmt = select(Alert).order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    if user.role != UserRole.ADMIN:
        # Analysts only see their own alerts. Legacy ownerless rows
        # (user_id IS NULL, created in Phase 0-3 before auth) stay
        # visible only to admins.
        stmt = stmt.where(Alert.user_id == user.id)
    return list(db.scalars(stmt).all())


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: int, db: DbSession, user: CurrentUser) -> Alert:
    alert = db.get(Alert, alert_id, options=[selectinload(Alert.recommendations)])
    if alert is None:
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    if user.role != UserRole.ADMIN and alert.user_id != user.id:
        # Don't reveal existence to non-owners.
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    return alert
