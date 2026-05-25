"""create group_messages table

Adds the table backing /api/groupchat — a single team-wide channel where
any authenticated user can post short messages. User identity is also
snapshotted as `user_email` / `user_name` so deleted accounts don't leave
unreadable rows behind.

Revision ID: 0005_group_messages
Revises: 0004_app_settings
Create Date: 2026-05-24

"""
import sqlalchemy as sa

from alembic import op

revision = "0005_group_messages"
down_revision = "0004_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'group_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('user_email', sa.String(255), nullable=False),
        sa.Column('user_name', sa.String(200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('group_messages')
