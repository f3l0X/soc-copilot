from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DbSession
from app.models import Alert
from app.schemas.alerts import AlertDetail, AlertSummary

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertSummary])
def list_alerts(
    db: DbSession,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[Alert]:
    stmt = select(Alert).order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: int, db: DbSession) -> Alert:
    alert = db.get(Alert, alert_id, options=[selectinload(Alert.recommendations)])
    if alert is None:
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    return alert
