"""Índice en group_messages.created_at

El modelo GroupMessage declara ``created_at`` con ``index=True``, pero la
migración 0005_group_messages no creó el índice. ``alembic check`` lo detecta
como diferencia entre modelos y migraciones y hace fallar el CI de E2E.

Revision ID: 0008_gm_created_at_index
Revises: 0007_password_reset
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_gm_created_at_index"
down_revision: str | Sequence[str] | None = "0007_password_reset"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_group_messages_created_at",
        "group_messages",
        ["created_at"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_group_messages_created_at",
        table_name="group_messages",
        if_exists=True,
    )
