import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.middleware.ratelimit import rate_limit
from app.models import Alert
from app.schemas.alerts import (
    AlertAnalyzeRequest,
    AlertDetail,
    AlertEscalateRequest,
    AlertResolveRequest,
    AlertSummary,
)
from app.services.alert_access import can_view_alert, scope_visible_alerts
from app.services.alert_workflow import (
    OPEN_STATUSES,
    QUEUE_STATUSES,
    WorkflowError,
    apply_assign,
    apply_escalate,
    apply_reopen,
    apply_resolve,
    check_analyze,
    record_analysis,
)
from app.services.audit import log_audit
from app.services.explainer import explain
from app.services.language import resolve_language
from app.services.llm import LLMProviderError, LLMResponseError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertSummary])
def list_alerts(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    origin: Literal["manual", "wazuh"] | None = Query(None),
    pending: bool | None = Query(
        None, description="true = only alerts without AI analysis yet"
    ),
    queue: Literal["new", "escalated", "in_progress", "mine", "closed"] | None = Query(
        None,
        description=(
            "Cola del ciclo de vida: new, in_progress (asignadas), escalated, "
            "mine (asignadas a mí) o closed"
        ),
    ),
) -> list[Alert]:
    stmt = select(Alert).order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    # Analysts see their own alerts + the shared Wazuh queue; admins see all.
    stmt = scope_visible_alerts(stmt, user)
    if origin is not None:
        stmt = stmt.where(Alert.origin == origin)
    if pending is True:
        stmt = stmt.where(Alert.analyzed_at.is_(None))
    elif pending is False:
        stmt = stmt.where(Alert.analyzed_at.is_not(None))
    if queue == "mine":
        stmt = stmt.where(
            Alert.assigned_to_id == user.id, Alert.status.in_(tuple(OPEN_STATUSES))
        )
    elif queue is not None:
        stmt = stmt.where(Alert.status.in_(QUEUE_STATUSES[queue]))
    return list(db.scalars(stmt).all())


def _workflow_http(exc: WorkflowError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _get_visible(db, user, alert_id: int) -> Alert:
    alert = db.get(
        Alert,
        alert_id,
        options=[selectinload(Alert.recommendations), selectinload(Alert.events)],
    )
    if alert is None or not can_view_alert(user, alert):
        # Don't reveal existence to users who can't see it.
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    return alert


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: int, db: DbSession, user: CurrentUser) -> Alert:
    return _get_visible(db, user, alert_id)


@router.post(
    "/{alert_id}/analyze",
    response_model=AlertDetail,
    dependencies=[Depends(rate_limit)],
)
def analyze_alert(
    alert_id: int,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    payload: AlertAnalyzeRequest | None = None,
) -> Alert:
    """Run the Alert Explainer on an already-stored alert (e.g. from Wazuh).

    Requires the alert to be assigned to the caller (admins always pass).
    Overwrites summary / risk / MITRE / reasoning with the AI result.
    """
    alert = _get_visible(db, user, alert_id)
    # Hay que tener la alerta asignada para analizarla (el admin, siempre).
    try:
        check_analyze(user, alert)
    except WorkflowError as exc:
        raise _workflow_http(exc) from None
    model = payload.model if payload else None
    language = resolve_language(payload.language if payload else None, request)
    try:
        result = explain(
            alert.log, alert.source, model=model, user=user, db=db, language=language
        )
    except LLMProviderError:
        logger.exception("LLM provider error in /alerts/{id}/analyze")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider error"
        ) from None
    except (LLMResponseError, ValidationError):
        logger.exception("LLM response could not be processed in /alerts/analyze")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI response could not be processed",
        ) from None

    alert.summary = result.summary
    alert.risk_level = result.risk_level
    # Keep Wazuh's own MITRE mapping if the model returns none.
    alert.mitre_techniques = result.mitre_techniques or alert.mitre_techniques
    alert.reasoning = result.reasoning
    alert.analyzed_at = datetime.now(UTC)
    if alert.user_id is None:
        alert.user_id = user.id
    record_analysis(db, alert, user)
    log_audit(
        db,
        actor=user,
        action="alert.analyze",
        target_type="alert",
        target_id=alert.id,
        details={"origin": alert.origin, "risk_level": alert.risk_level},
    )
    db.commit()
    db.refresh(alert)
    return alert


# ─── Ciclo de vida: escalar, asignar, cerrar, reabrir (Práctica 3) ──────────



def _finish(db, user, alert: Alert, action: str, details: dict) -> Alert:
    log_audit(
        db,
        actor=user,
        action=f"alert.{action}",
        target_type="alert",
        target_id=alert.id,
        details={"status": alert.status, **details},
    )
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/escalate", response_model=AlertDetail)
def escalate_alert(
    alert_id: int, payload: AlertEscalateRequest, db: DbSession, user: CurrentUser
) -> Alert:
    """Escala la alerta al siguiente nivel con una nota obligatoria."""
    alert = _get_visible(db, user, alert_id)
    try:
        apply_escalate(db, alert, user, payload.note)
    except WorkflowError as exc:
        raise _workflow_http(exc) from None
    return _finish(db, user, alert, "escalate", {})


@router.post("/{alert_id}/assign", response_model=AlertDetail)
def assign_alert(alert_id: int, db: DbSession, user: CurrentUser) -> Alert:
    """El analista (L2, INSTRUCTOR o admin) se asigna la alerta para investigarla."""
    alert = _get_visible(db, user, alert_id)
    try:
        apply_assign(db, alert, user)
    except WorkflowError as exc:
        raise _workflow_http(exc) from None
    return _finish(db, user, alert, "assign", {})


@router.post("/{alert_id}/resolve", response_model=AlertDetail)
def resolve_alert(
    alert_id: int, payload: AlertResolveRequest, db: DbSession, user: CurrentUser
) -> Alert:
    """Cierra la alerta como resuelta o falso positivo, con la resolución."""
    alert = _get_visible(db, user, alert_id)
    try:
        apply_resolve(db, alert, user, payload.verdict, payload.resolution)
    except WorkflowError as exc:
        raise _workflow_http(exc) from None
    return _finish(db, user, alert, "resolve", {"verdict": payload.verdict})


@router.post("/{alert_id}/reopen", response_model=AlertDetail)
def reopen_alert(alert_id: int, db: DbSession, user: CurrentUser) -> Alert:
    """Reabre una alerta cerrada (L2, INSTRUCTOR o admin) y se la asigna."""
    alert = _get_visible(db, user, alert_id)
    try:
        apply_reopen(db, alert, user)
    except WorkflowError as exc:
        raise _workflow_http(exc) from None
    return _finish(db, user, alert, "reopen", {})
