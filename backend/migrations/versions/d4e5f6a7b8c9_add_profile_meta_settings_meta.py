"""add profile_meta and settings_meta to student_profiles

Revision ID: d4e5f6a7b8c9
Revises: bbdf869bf7f8
Create Date: 2026-07-10 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "bbdf869bf7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_profiles",
        sa.Column("profile_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column(
        "student_profiles",
        sa.Column("settings_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("student_profiles", "settings_meta")
    op.drop_column("student_profiles", "profile_meta")
