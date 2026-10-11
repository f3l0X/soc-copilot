"""Ciclo de vida de las alertas y escalado por nivel SOC (Práctica 3)

Añade a ``alerts`` el estado, la asignación, el escalado y la resolución, y
crea ``alert_events`` con el historial de cada alerta. Las alertas que ya
tenían análisis pasan a ``triaged``; el resto se quedan en ``new``.

Revision ID: 0009_alert_workflow
Revises: 0008_gm_created_at_index
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_alert_workflow"
down_revision: str | Sequence[str] | None = "0008_gm_created_at_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── Columnas nuevas en alerts ──────────────────────────────────────
    op.add_column(
        "alerts",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
    )
    op.add_column("alerts", sa.Column("assigned_to_id", sa.Integer(), nullable=True))
    op.add_column("alerts", sa.Column("escalation_note", sa.Text(), nullable=True))
    op.add_column(
        "alerts", sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("alerts", sa.Column("escalated_by_id", sa.Integer(), nullable=True))
    op.add_column("alerts", sa.Column("resolution", sa.Text(), nullable=True))
    op.add_column(
        "alerts", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("alerts", sa.Column("resolved_by_id", sa.Integer(), nullable=True))

    op.create_index(op.f("ix_alerts_status"), "alerts", ["status"], unique=False)
    op.create_index(
        op.f("ix_alerts_assigned_to_id"), "alerts", ["assigned_to_id"], unique=False
    )
    op.create_foreign_key(
        "fk_alerts_assigned_to_id_users", "alerts", "users",
        ["assigned_to_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_alerts_escalated_by_id_users", "alerts", "users",
        ["escalated_by_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_alerts_resolved_by_id_users", "alerts", "users",
        ["resolved_by_id"], ["id"], ondelete="SET NULL",
    )

    # Las alertas ya analizadas empiezan como triadas.
    op.execute("UPDATE alerts SET status = 'triaged' WHERE analyzed_at IS NOT NULL")

    # ── Historial de cada alerta ───────────────────────────────────────
    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "alert_id",
            sa.Integer(),
            sa.ForeignKey("alerts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_alert_events_alert_id"), "alert_events", ["alert_id"], unique=False
    )
    op.create_index(
        op.f("ix_alert_events_actor_id"), "alert_events", ["actor_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_alert_events_actor_id"), table_name="alert_events")
    op.drop_index(op.f("ix_alert_events_alert_id"), table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_constraint("fk_alerts_resolved_by_id_users", "alerts", type_="foreignkey")
    op.drop_constraint("fk_alerts_escalated_by_id_users", "alerts", type_="foreignkey")
    op.drop_constraint("fk_alerts_assigned_to_id_users", "alerts", type_="foreignkey")
    op.drop_index(op.f("ix_alerts_assigned_to_id"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_status"), table_name="alerts")
    for column in (
        "resolved_by_id",
        "resolved_at",
        "resolution",
        "escalated_by_id",
        "escalated_at",
        "escalation_note",
        "assigned_to_id",
        "status",
    ):
        op.drop_column("alerts", column)
