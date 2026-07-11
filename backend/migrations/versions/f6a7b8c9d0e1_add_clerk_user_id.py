"""add clerk_user_id to users for Clerk auth linking

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-11 09:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "59afa7d4a79e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_user_id", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_clerk_user_id"), "users", ["clerk_user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_clerk_user_id"), table_name="users")
    op.drop_column("users", "clerk_user_id")
