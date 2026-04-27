"""End-to-end auth + ownership flow against a real Postgres.

Skipped automatically unless RUN_E2E=1 is exported, so the unit suite
keeps running offline. CI sets RUN_E2E=1 plus the standard POSTGRES_*
env vars and brings up a postgres service alongside.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

if os.environ.get("RUN_E2E") != "1":  # pragma: no cover
    pytest.skip("E2E suite skipped (set RUN_E2E=1)", allow_module_level=True)


# Importing main triggers init_db() against the live DB.
from app.db import _engine, init_db  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def _prepare_db():
    """Per-test wipe so each test starts on a clean slate (the
    'first user becomes admin' rule depends on row counts)."""
    init_db()
    with _engine.begin() as conn:
        conn.execute(text("DELETE FROM recommendations"))
        conn.execute(text("DELETE FROM alerts"))
        conn.execute(text("DELETE FROM users"))
    yield


def _email() -> str:
    return f"e2e-{uuid.uuid4().hex[:8]}@example.com"


def test_first_user_becomes_admin_and_full_flow():
    admin_email = _email()
    admin_pw = "adminpass-strong-12345"

    # Register → first user is admin
    r = client.post(
        "/api/auth/register",
        json={"email": admin_email, "password": admin_pw},
    )
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "admin"

    # Wrong password rejected
    r = client.post(
        "/api/auth/login",
        json={"email": admin_email, "password": "wrong-password"},
    )
    assert r.status_code == 401

    # Correct login sets the cookie
    r = client.post(
        "/api/auth/login",
        json={"email": admin_email, "password": admin_pw},
    )
    assert r.status_code == 200
    assert "soc_session" in r.cookies

    # Cookie is httpOnly + SameSite Lax
    set_cookie = r.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert "samesite=lax" in set_cookie.lower()

    # /me works with the cookie session
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == admin_email

    # Second register → analyst role
    analyst_email = _email()
    analyst_pw = "analystpass-xyz-9999"
    r = client.post(
        "/api/auth/register",
        json={"email": analyst_email, "password": analyst_pw},
    )
    assert r.status_code == 201
    assert r.json()["role"] == "analyst"

    # Logout invalidates the cookie session
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_ownership_isolation_between_users(monkeypatch):
    """Two analysts each see only their own alerts; admin sees both."""
    # Create three users
    admin_email = _email()
    a_email = _email()
    b_email = _email()
    pw = "shared-strong-pw-1234"
    for email in [admin_email, a_email, b_email]:
        r = client.post(
            "/api/auth/register", json={"email": email, "password": pw}
        )
        assert r.status_code == 201, r.text

    # Inject a fake LLM so /api/explain succeeds without hitting Gemini.
    import app.services.llm as llm_module
    from app.services.llm import LLMAdapter

    class FakeLLM(LLMAdapter):
        def generate_json(self, prompt, *, schema, system=None, temperature=0.2, model=None):
            return {
                "summary": "x",
                "risk_level": "low",
                "mitre_techniques": [],
                "reasoning": "y",
            }

        def generate_text(self, prompt, *, system=None, temperature=0.2, model=None):
            return "x"

        def embed(self, texts):
            return [[0.0]]

    monkeypatch.setattr(llm_module, "_singleton", FakeLLM())

    def _login(email: str) -> TestClient:
        c = TestClient(app)
        r = c.post("/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        return c

    # Each analyst creates one alert
    ca = _login(a_email)
    rA = ca.post("/api/explain", json={"log": "alert A"}).json()
    cb = _login(b_email)
    rB = cb.post("/api/explain", json={"log": "alert B"}).json()
    assert rA["id"] != rB["id"]

    # Analyst A only sees A's alert
    listed = ca.get("/api/alerts?limit=50").json()
    ids = {a["id"] for a in listed}
    assert rA["id"] in ids
    assert rB["id"] not in ids

    # Analyst A cannot read B's alert (404, not 403, to avoid existence leak)
    detail = ca.get(f"/api/alerts/{rB['id']}")
    assert detail.status_code == 404

    # Admin sees both
    cadmin = _login(admin_email)
    listed_admin = cadmin.get("/api/alerts?limit=50").json()
    ids_admin = {a["id"] for a in listed_admin}
    assert rA["id"] in ids_admin and rB["id"] in ids_admin
