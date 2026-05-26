"""End-to-end tests for /api/groupchat.

Cubre el contrato del chat grupal: auth, persistencia con snapshot de
identidad, polling incremental y supervivencia al borrado del autor.

Se skipea automáticamente fuera de CI (mismo gate RUN_E2E=1 que el resto
de la suite E2E, requiere Postgres real porque la tabla group_messages
usa server_default=NOW() y ARRAY/JSONB en otras tablas relacionadas).
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

if os.environ.get("RUN_E2E") != "1":  # pragma: no cover
    pytest.skip("E2E suite skipped (set RUN_E2E=1)", allow_module_level=True)


from app.db import _engine, init_db
from app.main import app
from app.middleware import ratelimit

client = TestClient(app)


@pytest.fixture(autouse=True)
def _prepare_db():
    init_db()
    with _engine.begin() as conn:
        conn.execute(text("DELETE FROM group_messages"))
        conn.execute(text("DELETE FROM recommendations"))
        conn.execute(text("DELETE FROM alerts"))
        conn.execute(text("DELETE FROM audit_logs"))
        conn.execute(text("DELETE FROM users"))
    ratelimit.reset()
    yield


def _email() -> str:
    return f"gc-{uuid.uuid4().hex[:8]}@example.com"


def _register_and_login(name: str, last_name: str = "") -> tuple[str, str]:
    """Crea un usuario y devuelve (email, password) tras dejar la cookie
    de sesión activa en el TestClient."""
    email = _email()
    pw = "Groupchat-Strong-Pass-1!"
    r = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "last_name": last_name,
            "email": email,
            "password": pw,
        },
    )
    assert r.status_code == 201, r.text
    ratelimit.reset()
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return email, pw


def _logout() -> None:
    client.post("/api/auth/logout")
    client.cookies.clear()
    ratelimit.reset()


def _login(email: str, password: str) -> None:
    ratelimit.reset()
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text


# ─── 1. Auth ─────────────────────────────────────────────────────────────


def test_groupchat_requires_auth():
    """Sin cookie, GET/POST/poll devuelven 401."""
    client.cookies.clear()
    assert client.get("/api/groupchat").status_code == 401
    assert (
        client.post("/api/groupchat", json={"content": "hola"}).status_code == 401
    )
    assert client.get("/api/groupchat/poll?after_id=0").status_code == 401


# ─── 2. Post + list ──────────────────────────────────────────────────────


def test_groupchat_post_and_list_across_users():
    """Un usuario postea, el otro lee y ve el snapshot de identidad."""
    # Admin bootstrap (auto-verified, auto-admin)
    _register_and_login("Alice", "Smith")
    _logout()

    # Segundo usuario (analyst)
    bob_email, _ = _register_and_login("Bob", "Jones")

    r = client.post("/api/groupchat", json={"content": "  bruteforce SSH desde 1.2.3.4  "})
    assert r.status_code == 201, r.text
    msg = r.json()
    # strip() en backend
    assert msg["content"] == "bruteforce SSH desde 1.2.3.4"
    assert msg["user_email"] == bob_email
    assert msg["user_name"] == "Bob Jones"
    assert msg["user_id"] is not None
    bob_msg_id = msg["id"]

    _logout()

    # Alice (admin) lo lee
    _login(_alice_email_from_db(), "Groupchat-Strong-Pass-1!")

    r = client.get("/api/groupchat")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["id"] == bob_msg_id
    assert rows[0]["user_email"] == bob_email
    assert rows[0]["user_name"] == "Bob Jones"


def _alice_email_from_db() -> str:
    """Helper: el primer usuario insertado (admin) tras el wipe."""
    with _engine.begin() as conn:
        row = conn.execute(
            text("SELECT email FROM users ORDER BY id ASC LIMIT 1")
        ).fetchone()
    assert row is not None
    return row[0]


# ─── 3. Poll incremental ─────────────────────────────────────────────────


def test_groupchat_poll_returns_only_new_messages():
    """poll?after_id=N devuelve solo mensajes con id > N."""
    _register_and_login("Solo", "User")

    r1 = client.post("/api/groupchat", json={"content": "m1"})
    assert r1.status_code == 201
    m1_id = r1.json()["id"]

    # Sin nada nuevo después de m1
    r = client.get(f"/api/groupchat/poll?after_id={m1_id}")
    assert r.status_code == 200
    assert r.json() == []

    # Llega m2; poll desde m1 lo devuelve, poll desde m2 no
    r2 = client.post("/api/groupchat", json={"content": "m2"})
    assert r2.status_code == 201
    m2_id = r2.json()["id"]

    r = client.get(f"/api/groupchat/poll?after_id={m1_id}")
    body = r.json()
    assert [m["id"] for m in body] == [m2_id]
    assert body[0]["content"] == "m2"

    r = client.get(f"/api/groupchat/poll?after_id={m2_id}")
    assert r.json() == []


# ─── 4. Snapshot sobrevive al borrado del autor ──────────────────────────


def test_groupchat_message_survives_author_deletion():
    """Tras borrar el autor, user_id queda NULL pero email/name persisten."""
    # Admin (Alice) bootstrap
    alice_email, alice_pw = _register_and_login("Alice", "Admin")
    _logout()

    # Bob postea
    bob_email, _ = _register_and_login("Bob", "ToBeDeleted")
    r = client.post("/api/groupchat", json={"content": "mensaje histórico"})
    assert r.status_code == 201
    msg_id = r.json()["id"]
    bob_user_id = r.json()["user_id"]
    assert bob_user_id is not None

    _logout()

    # Alice (admin) borra a Bob
    _login(alice_email, alice_pw)
    r = client.delete(f"/api/admin/users/{bob_user_id}")
    assert r.status_code == 204, r.text

    # El mensaje sigue listable; user_id es NULL, snapshot intacto
    r = client.get("/api/groupchat")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["id"] == msg_id
    assert rows[0]["user_id"] is None
    assert rows[0]["user_email"] == bob_email
    assert rows[0]["user_name"] == "Bob ToBeDeleted"
    assert rows[0]["content"] == "mensaje histórico"


# ─── 5. Validación de contenido ──────────────────────────────────────────


def test_groupchat_rejects_empty_and_oversized_content():
    _register_and_login("Val", "Idator")

    # Vacío → 422 (Pydantic min_length=1)
    r = client.post("/api/groupchat", json={"content": ""})
    assert r.status_code == 422

    # 2001 chars → 422 (max_length=2000)
    r = client.post("/api/groupchat", json={"content": "x" * 2001})
    assert r.status_code == 422

    # 2000 chars exactos → 201
    r = client.post("/api/groupchat", json={"content": "x" * 2000})
    assert r.status_code == 201
