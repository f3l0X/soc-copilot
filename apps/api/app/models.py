"""SQLAlchemy ORM models."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    log: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(200))

    # Output of /api/explain (filled when alert is created via that endpoint)
    summary: Mapped[str | None] = mapped_column(Text)
    risk_level: Mapped[str | None] = mapped_column(String(16))
    mitre_techniques: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))
    reasoning: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    )

    recommendations: Mapped[list[Recommendation]] = relationship(
        back_populates="alert",
        cascade="all, delete-orphan",
    )


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(
        ForeignKey("alerts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # JSONB list of {title, detail, rationale}
    actions: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    learning_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    )

    alert: Mapped[Alert] = relationship(back_populates="recommendations")
