"""Reglas del ciclo de vida de las alertas por nivel SOC (Práctica 3).

Prueban las comprobaciones de services.alert_workflow sin base de datos.
"""
from types import SimpleNamespace

import pytest

from app.models import UserLevel, UserRole
from app.services.alert_workflow import (
    QUEUE_STATUSES,
    WorkflowError,
    check_assign,
    check_escalate,
    check_reopen,
    check_resolve,
    is_senior,
)


def _user(level: UserLevel, role: UserRole = UserRole.ANALYST) -> SimpleNamespace:
    return SimpleNamespace(id=1, email="t@test.com", level=level, role=role)


def _alert(status: str = "triaged", risk: str | None = "high") -> SimpleNamespace:
    return SimpleNamespace(id=1, status=status, risk_level=risk)


L1 = _user(UserLevel.L1)
L2 = _user(UserLevel.L2)
INSTRUCTOR = _user(UserLevel.INSTRUCTOR)
ADMIN_L1 = _user(UserLevel.L1, UserRole.ADMIN)


def _code(fn, *args) -> int | None:
    try:
        fn(*args)
    except WorkflowError as exc:
        return exc.status_code
    return None


# ── Quién es "senior" ──────────────────────────────────────────────────


def test_is_senior_by_level_and_admin_role():
    assert not is_senior(L1)
    assert is_senior(L2)
    assert is_senior(INSTRUCTOR)
    assert is_senior(ADMIN_L1)


# ── Escalar ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("status", ["new", "triaged", "in_progress"])
def test_any_level_can_escalate_open_alert(status):
    assert _code(check_escalate, L1, _alert(status)) is None


def test_cannot_escalate_twice():
    assert _code(check_escalate, L1, _alert("escalated")) == 409


@pytest.mark.parametrize("status", ["resolved", "false_positive"])
def test_cannot_escalate_closed_alert(status):
    assert _code(check_escalate, L2, _alert(status)) == 409


# ── Asignarse ──────────────────────────────────────────────────────────


def test_l1_cannot_take_alerts():
    assert _code(check_assign, L1, _alert("escalated")) == 403


@pytest.mark.parametrize("user", [L2, INSTRUCTOR, ADMIN_L1])
def test_senior_can_take_escalated_alert(user):
    assert _code(check_assign, user, _alert("escalated")) is None


def test_cannot_take_closed_alert():
    assert _code(check_assign, L2, _alert("resolved")) == 409


# ── Cerrar ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("risk", ["low", "medium", "LOW"])
@pytest.mark.parametrize("verdict", ["resolved", "false_positive"])
def test_l1_can_close_low_and_medium(risk, verdict):
    assert _code(check_resolve, L1, _alert("triaged", risk), verdict) is None


@pytest.mark.parametrize("risk", ["high", "critical", None])
def test_l1_cannot_close_high_critical_or_unanalysed(risk):
    assert _code(check_resolve, L1, _alert("triaged", risk), "false_positive") == 403


@pytest.mark.parametrize("risk", ["high", "critical", None])
def test_senior_can_close_any_risk(risk):
    assert _code(check_resolve, L2, _alert("in_progress", risk), "resolved") is None


def test_cannot_close_twice():
    assert _code(check_resolve, L2, _alert("resolved"), "resolved") == 409


def test_invalid_verdict_rejected():
    assert _code(check_resolve, L2, _alert("in_progress"), "escalated") == 409


# ── Reabrir ────────────────────────────────────────────────────────────


def test_l1_cannot_reopen():
    assert _code(check_reopen, L1, _alert("resolved")) == 403


def test_senior_can_reopen_closed():
    assert _code(check_reopen, L2, _alert("false_positive")) is None


def test_cannot_reopen_open_alert():
    assert _code(check_reopen, L2, _alert("in_progress")) == 409


# ── Colas ──────────────────────────────────────────────────────────────


def test_queues_cover_every_status_once():
    statuses = [s for group in QUEUE_STATUSES.values() for s in group]
    assert sorted(statuses) == sorted(
        ["new", "triaged", "escalated", "in_progress", "resolved", "false_positive"]
    )
