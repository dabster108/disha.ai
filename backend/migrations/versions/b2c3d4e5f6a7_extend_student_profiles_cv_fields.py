"""extend student_profiles with CV fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-10 13:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("student_profiles", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column("student_profiles", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("student_profiles", sa.Column("phone", sa.String(length=50), nullable=True))
    op.add_column("student_profiles", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("student_profiles", sa.Column("years_of_experience", sa.Float(), nullable=True))
    op.add_column(
        "student_profiles",
        sa.Column("education", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
    )
    op.add_column(
        "student_profiles",
        sa.Column("experience", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("student_profiles", "experience")
    op.drop_column("student_profiles", "education")
    op.drop_column("student_profiles", "years_of_experience")
    op.drop_column("student_profiles", "summary")
    op.drop_column("student_profiles", "phone")
    op.drop_column("student_profiles", "email")
    op.drop_column("student_profiles", "full_name")
