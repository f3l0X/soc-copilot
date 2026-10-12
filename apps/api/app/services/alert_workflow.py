"""Ciclo de vida de las alertas y reglas por nivel SOC (Práctica 3).

Estados::

    new ──asignar──▶ in_progress ("Asignada a …") ──escalar──▶ escalated
                         │    ▲                                     │
                         │    └──────────── asignar (L2) ───────────┘
                         └── cerrar ──▶ resolved / false_positive ──reabrir (L2)──▶ in_progress

Reglas (se comprueban aquí, en la API; la web solo oculta botones):

- Para analizar, escalar o cerrar una alerta hay que tenerla asignada. El rol
  ADMIN puede hacerlo siempre.
- Un L1 solo puede asignarse alertas nuevas. L2, INSTRUCTOR y ADMIN pueden
  asignarse también las escaladas y quitársela a otro analista.
- Un L1 solo puede cerrar alertas analizadas de riesgo bajo o medio; las
  altas, críticas o sin analizar las tiene que escalar.
- Solo L2, INSTRUCTOR o ADMIN pueden reabrir alertas cerradas.

Las funciones ``check_*`` solo leen atributos y lanzan ``WorkflowError``, así
se pueden probar sin base de datos. Las ``apply_*`` aplican el cambio y
registran el evento en ``alert_events``.
"""
from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from app.models import Alert, AlertEvent, User, UserLevel, UserRole


class AlertStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"  # en la web: "Asignada"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


# Conjuntos de *strings* (no de miembros del Enum): el hash de un Enum no
# coincide con el de su valor, y la columna ``status`` devuelve strings.
OPEN_STATUSES: frozenset[str] = frozenset(
    s.value for s in (AlertStatus.NEW, AlertStatus.IN_PROGRESS, AlertStatus.ESCALATED)
)
CLOSED_STATUSES: frozenset[str] = frozenset(
    s.value for s in (AlertStatus.RESOLVED, AlertStatus.FALSE_POSITIVE)
)
# Riesgos que un L1 puede cerrar por sí mismo.
L1_CLOSABLE_RISKS: frozenset[str] = frozenset({"low", "medium"})

# Colas de la página SIEM → estados que incluye cada una.
QUEUE_STATUSES: dict[str, tuple[str, ...]] = {
    "new": (AlertStatus.NEW.value,),
    "in_progress": (AlertStatus.IN_PROGRESS.value,),
    "escalated": (AlertStatus.ESCALATED.value,),
    "closed": (AlertStatus.RESOLVED.value, AlertStatus.FALSE_POSITIVE.value),
}


class WorkflowError(Exception):
    """Acción no permitida. ``status_code``: 403 (permiso) o 409 (estado)."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def is_admin(user: Any) -> bool:
    return user.role == UserRole.ADMIN


def is_senior(user: Any) -> bool:
    """L2, INSTRUCTOR o administrador de la plataforma."""
    return is_admin(user) or user.level in (UserLevel.L2, UserLevel.INSTRUCTOR)


def is_assignee(user: Any, alert: Any) -> bool:
    return alert.assigned_to_id is not None and alert.assigned_to_id == user.id


def _require_assignee(user: Any, alert: Any, what: str) -> None:
    if not (is_assignee(user, alert) or is_admin(user)):
        raise WorkflowError(403, f"assign the alert to yourself before you {what} it")


# ─── Comprobaciones (sin base de datos) ─────────────────────────────────────


def check_assign(user: Any, alert: Any) -> None:
    if alert.status not in OPEN_STATUSES:
        raise WorkflowError(409, "only open alerts can be assigned")
    if is_assignee(user, alert):
        raise WorkflowError(409, "the alert is already assigned to you")
    if alert.status != AlertStatus.NEW.value and not is_senior(user):
        raise WorkflowError(403, "L1 can only take new alerts")


def check_analyze(user: Any, alert: Any) -> None:
    if alert.status not in OPEN_STATUSES:
        raise WorkflowError(409, "closed alerts can't be analysed again; reopen it first")
    _require_assignee(user, alert, "analyse")


def check_escalate(user: Any, alert: Any) -> None:
    if alert.status not in OPEN_STATUSES:
        raise WorkflowError(409, "only open alerts can be escalated")
    if alert.status == AlertStatus.ESCALATED.value:
        raise WorkflowError(409, "alert is already escalated")
    _require_assignee(user, alert, "escalate")


def check_resolve(user: Any, alert: Any, verdict: str) -> None:
    if verdict not in CLOSED_STATUSES:
        raise WorkflowError(409, f"invalid verdict {verdict!r}")
    if alert.status not in OPEN_STATUSES:
        raise WorkflowError(409, "alert is already closed")
    _require_assignee(user, alert, "close")
    if not is_senior(user) and (alert.risk_level or "").lower() not in L1_CLOSABLE_RISKS:
        raise WorkflowError(
            403,
            "L1 can only close analysed low/medium alerts; escalate this one to L2",
        )


def check_reopen(user: Any, alert: Any) -> None:
    if not is_senior(user):
        raise WorkflowError(403, "only L2, INSTRUCTOR or admin can reopen alerts")
    if alert.status not in CLOSED_STATUSES:
        raise WorkflowError(409, "only closed alerts can be reopened")


# ─── Aplicar cambios ────────────────────────────────────────────────────────


def _record(
    db: Session,
    alert: Alert,
    user: User,
    action: str,
    from_status: str | None,
    note: str | None = None,
) -> None:
    db.add(
        AlertEvent(
            alert_id=alert.id,
            actor_id=user.id,
            actor_email=user.email,
            action=action,
            from_status=from_status,
            to_status=alert.status,
            note=note,
        )
    )


def apply_assign(db: Session, alert: Alert, user: User) -> None:
    check_assign(user, alert)
    previous = alert.status
    alert.status = AlertStatus.IN_PROGRESS.value
    alert.assigned_to_id = user.id
    _record(db, alert, user, "assign", previous)


def record_analysis(db: Session, alert: Alert, user: User) -> None:
    """Deja constancia del análisis con IA. No cambia el estado."""
    _record(db, alert, user, "analyze", alert.status)


def apply_escalate(db: Session, alert: Alert, user: User, note: str) -> None:
    check_escalate(user, alert)
    previous = alert.status
    alert.status = AlertStatus.ESCALATED.value
    alert.escalation_note = note
    alert.escalated_at = datetime.now(UTC)
    alert.escalated_by_id = user.id
    alert.assigned_to_id = None
    _record(db, alert, user, "escalate", previous, note)


def apply_resolve(
    db: Session, alert: Alert, user: User, verdict: str, resolution: str
) -> None:
    check_resolve(user, alert, verdict)
    previous = alert.status
    alert.status = AlertStatus(verdict).value
    alert.resolution = resolution
    alert.resolved_at = datetime.now(UTC)
    alert.resolved_by_id = user.id
    _record(db, alert, user, "resolve", previous, resolution)


def apply_reopen(db: Session, alert: Alert, user: User, note: str | None = None) -> None:
    check_reopen(user, alert)
    previous = alert.status
    alert.status = AlertStatus.IN_PROGRESS.value
    alert.assigned_to_id = user.id
    alert.resolved_at = None
    alert.resolved_by_id = None
    _record(db, alert, user, "reopen", previous, note)
