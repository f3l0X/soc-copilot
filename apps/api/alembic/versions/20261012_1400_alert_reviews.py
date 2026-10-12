"""Valoración del Instructor sobre las decisiones de los analistas

Crea ``alert_reviews``: una valoración (correcta, mejorable o incorrecta) con
comentario por alerta escalada o cerrada.

Revision ID: 0011_alert_reviews
Revises: 0010_alert_assignment_flow
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_alert_reviews"
down_revision: str | Sequence[str] | None = "0010_alert_assignment_flow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alert_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "alert_id",
            sa.Integer(),
            sa.ForeignKey("alerts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewer_email", sa.String(length=255), nullable=False),
        sa.Column(
            "analyst_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.String(length=16), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("alert_id", name="uq_alert_reviews_alert_id"),
    )


def downgrade() -> None:
    op.drop_table("alert_reviews")
