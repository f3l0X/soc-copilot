"""Reglas del ciclo de vida de las alertas por nivel SOC (Práctica 3).

Prueban las comprobaciones de services.alert_workflow sin base de datos.
"""
from types import SimpleNamespace

import pytest

from app.models import UserLevel, UserRole
from app.services.alert_workflow import (
    QUEUE_STATUSES,
    WorkflowError,
    check_analyze,
    check_assign,
    check_escalate,
    check_reopen,
    check_resolve,
    check_review,
    decision_maker_id,
    is_senior,
)


def _user(uid: int, level: UserLevel, role: UserRole = UserRole.ANALYST) -> SimpleNamespace:
    return SimpleNamespace(id=uid, email=f"u{uid}@test.com", level=level, role=role)


def _alert(
    status: str = "in_progress", risk: str | None = "high", assigned: int | None = 1
) -> SimpleNamespace:
    return SimpleNamespace(id=1, status=status, risk_level=risk, assigned_to_id=assigned)


L1 = _user(1, UserLevel.L1)            # el asignado por defecto en _alert()
OTHER_L1 = _user(2, UserLevel.L1)
L2 = _user(3, UserLevel.L2)
INSTRUCTOR = _user(4, UserLevel.INSTRUCTOR)
ADMIN = _user(5, UserLevel.L1, UserRole.ADMIN)


def _code(fn, *args) -> int | None:
    try:
        fn(*args)
    except WorkflowError as exc:
        return exc.status_code
    return None


def test_is_senior_by_level_and_admin_role():
    assert not is_senior(L1)
    assert is_senior(L2)
    assert is_senior(INSTRUCTOR)
    assert is_senior(ADMIN)


# ── Asignarse ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("user", [L1, L2, INSTRUCTOR, ADMIN])
def test_anyone_can_take_a_new_alert(user):
    assert _code(check_assign, user, _alert("new", assigned=None)) is None


def test_l1_cannot_take_escalated_alert():
    assert _code(check_assign, L1, _alert("escalated", assigned=None)) == 403


def test_l1_cannot_take_alert_assigned_to_someone_else():
    assert _code(check_assign, OTHER_L1, _alert("in_progress", assigned=1)) == 403


@pytest.mark.parametrize("user", [L2, INSTRUCTOR, ADMIN])
def test_senior_can_take_escalated_or_others_alert(user):
    assert _code(check_assign, user, _alert("escalated", assigned=None)) is None
    assert _code(check_assign, user, _alert("in_progress", assigned=1)) is None


def test_cannot_take_alert_already_mine():
    assert _code(check_assign, L1, _alert("in_progress", assigned=1)) == 409


def test_cannot_take_closed_alert():
    assert _code(check_assign, L2, _alert("resolved", assigned=None)) == 409


# ── Analizar ───────────────────────────────────────────────────────────


def test_assignee_can_analyse():
    assert _code(check_analyze, L1, _alert("in_progress", assigned=1)) is None


@pytest.mark.parametrize("status", ["new", "escalated"])
def test_cannot_analyse_without_taking_it(status):
    assert _code(check_analyze, L1, _alert(status, assigned=None)) == 403


def test_cannot_analyse_someone_elses_alert():
    assert _code(check_analyze, L2, _alert("in_progress", assigned=1)) == 403


def test_admin_can_always_analyse():
    assert _code(check_analyze, ADMIN, _alert("new", assigned=None)) is None


def test_cannot_analyse_closed_alert():
    assert _code(check_analyze, L1, _alert("resolved", assigned=1)) == 409


# ── Escalar ────────────────────────────────────────────────────────────


def test_assignee_can_escalate():
    assert _code(check_escalate, L1, _alert("in_progress", assigned=1)) is None


def test_cannot_escalate_without_taking_it():
    assert _code(check_escalate, OTHER_L1, _alert("in_progress", assigned=1)) == 403


def test_cannot_escalate_twice():
    assert _code(check_escalate, ADMIN, _alert("escalated", assigned=None)) == 409


@pytest.mark.parametrize("status", ["resolved", "false_positive"])
def test_cannot_escalate_closed_alert(status):
    assert _code(check_escalate, L1, _alert(status, assigned=1)) == 409


# ── Cerrar ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("risk", ["low", "medium", "LOW"])
@pytest.mark.parametrize("verdict", ["resolved", "false_positive"])
def test_l1_can_close_own_low_and_medium(risk, verdict):
    assert _code(check_resolve, L1, _alert("in_progress", risk, 1), verdict) is None


@pytest.mark.parametrize("risk", ["high", "critical", None])
def test_l1_cannot_close_high_critical_or_unanalysed(risk):
    assert _code(check_resolve, L1, _alert("in_progress", risk, 1), "false_positive") == 403


def test_cannot_close_someone_elses_alert():
    assert _code(check_resolve, L2, _alert("in_progress", "low", 1), "resolved") == 403


@pytest.mark.parametrize("risk", ["high", "critical", None])
def test_senior_assignee_can_close_any_risk(risk):
    assert _code(check_resolve, L2, _alert("in_progress", risk, 3), "resolved") is None


def test_cannot_close_twice():
    assert _code(check_resolve, ADMIN, _alert("resolved"), "resolved") == 409


def test_invalid_verdict_rejected():
    assert _code(check_resolve, L1, _alert("in_progress", "low", 1), "escalated") == 409


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
        ["new", "in_progress", "escalated", "resolved", "false_positive"]
    )


# ── Revisión del Instructor ────────────────────────────────────────────


def _decided(status: str, by: int | None) -> SimpleNamespace:
    return SimpleNamespace(
        id=1, status=status, risk_level="high", assigned_to_id=None,
        escalated_by_id=by if status == "escalated" else None,
        resolved_by_id=by if status in ("resolved", "false_positive") else None,
    )


@pytest.mark.parametrize("status", ["escalated", "resolved", "false_positive"])
@pytest.mark.parametrize("rating", ["correct", "improvable", "incorrect"])
def test_instructor_can_review_decisions(status, rating):
    assert _code(check_review, INSTRUCTOR, _decided(status, 1), rating) is None


@pytest.mark.parametrize("user", [L1, L2])
def test_only_instructor_or_admin_can_review(user):
    assert _code(check_review, user, _decided("resolved", 2), "correct") == 403


def test_admin_can_review():
    assert _code(check_review, ADMIN, _decided("escalated", 1), "improvable") is None


@pytest.mark.parametrize("status", ["new", "in_progress"])
def test_cannot_review_alert_without_decision(status):
    assert _code(check_review, INSTRUCTOR, _decided(status, 1), "correct") == 409


def test_cannot_review_own_decision():
    assert _code(check_review, INSTRUCTOR, _decided("resolved", 4), "correct") == 409


def test_invalid_rating_rejected():
    assert _code(check_review, INSTRUCTOR, _decided("resolved", 1), "great") == 409


def test_decision_maker_is_escalator_or_closer():
    assert decision_maker_id(_decided("escalated", 7)) == 7
    assert decision_maker_id(_decided("false_positive", 8)) == 8
