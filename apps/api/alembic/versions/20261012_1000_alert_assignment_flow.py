"""Asignación obligatoria antes de analizar; desaparece el estado "triaged"

Con el nuevo flujo, para analizar una alerta hay que tenerla asignada, así
que el estado intermedio "triaged" ya no existe:

- Las alertas "triaged" con analista (``user_id``, quien la analizó) pasan a
  "in_progress" asignadas a ese analista.
- Las que no tienen analista vuelven a "new".

No cambia el esquema, solo los datos.

Revision ID: 0010_alert_assignment_flow
Revises: 0009_alert_workflow
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_alert_assignment_flow"
down_revision: str | Sequence[str] | None = "0009_alert_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE alerts SET status = 'new' "
        "WHERE status = 'triaged' AND user_id IS NULL AND assigned_to_id IS NULL"
    )
    op.execute(
        "UPDATE alerts SET status = 'in_progress', "
        "assigned_to_id = COALESCE(assigned_to_id, user_id) "
        "WHERE status = 'triaged'"
    )


def downgrade() -> None:
    # Aproximación: las asignadas que se analizaron y nunca se escalaron
    # vuelven a "triaged", como en el flujo anterior.
    op.execute(
        "UPDATE alerts SET status = 'triaged' "
        "WHERE status = 'in_progress' AND analyzed_at IS NOT NULL "
        "AND escalated_at IS NULL"
    )
