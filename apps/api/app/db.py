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
    """Create tables that don't exist yet. Idempotent."""
    # Importing models registers them on Base.metadata.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=_engine)


# FastAPI dependency alias — avoids `Depends(get_db)` in defaults (B008).
DbSession = Annotated[Session, Depends(get_db)]
