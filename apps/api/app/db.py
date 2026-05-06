"""SQLAlchemy session factory + Base.

Tables are auto-created from models on app startup (see main.py). When the
schema changes substantially, run `docker compose down -v` to recreate.
For Phase 4 we'll introduce Alembic migrations.
"""
from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_settings = get_settings()
_engine = create_engine(_settings.database_url, pool_pre_ping=True, future=True)
_SessionLocal = sessionmaker(
    bind=_engine, autoflush=False, autocommit=False, future=True
)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped DB session."""
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables that don't exist yet, then run idempotent in-place
    column patches for schema evolutions we don't want to lose data over.

    Phase 4 adds users + alerts.user_id; without Alembic we use IF NOT
    EXISTS / ADD COLUMN IF NOT EXISTS so existing alert rows persist.
    """
    from sqlalchemy import text

    from app import models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(bind=_engine)

    with _engine.begin() as conn:
        # Postgres-only patches. SQLite (used in tests) skips these.
        if conn.dialect.name == "postgresql":
            conn.execute(
                text(
                    "ALTER TABLE alerts "
                    "ADD COLUMN IF NOT EXISTS user_id INTEGER "
                    "REFERENCES users(id) ON DELETE SET NULL"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_alerts_user_id "
                    "ON alerts (user_id)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS name VARCHAR(100) "
                    "DEFAULT 'Analista' NOT NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS password_version INTEGER "
                    "DEFAULT 0 NOT NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) "
                    "DEFAULT '' NOT NULL"
                )
            )
            # Phase 5: per-user Gemini key (optional, BYO) + quota tracking
            # against the shared server key.
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS gemini_api_key_ciphertext BYTEA"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS gemini_key_last4 VARCHAR(8)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS gemini_key_validated_at "
                    "TIMESTAMP WITH TIME ZONE"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS preferred_chat_model VARCHAR(64)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS server_llm_calls_today INTEGER "
                    "DEFAULT 0 NOT NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS server_llm_quota_date DATE"
                )
            )

    # The first user to POST /api/auth/register becomes ADMIN automatically
    # (see routers/auth.py). We deliberately do NOT seed a default admin here
    # to avoid shipping known credentials in production.


# FastAPI dependency alias — avoids `Depends(get_db)` in defaults (B008).
DbSession = Annotated[Session, Depends(get_db)]
