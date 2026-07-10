"""extend scrape_runs for run telemetry

Revision ID: a1b2c3d4e5f6
Revises: 274f692c1d08
Create Date: 2026-07-10 13:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "274f692c1d08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scrape_runs", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("scrape_runs", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("scrape_runs", sa.Column("duration_seconds", sa.Float(), nullable=True))
    op.add_column("scrape_runs", sa.Column("sources_requested", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("scrape_runs", sa.Column("sources_succeeded", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("scrape_runs", sa.Column("sources_failed", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("scrape_runs", sa.Column("jobs_by_source", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("scrape_runs", sa.Column("completeness_by_source", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("scrape_runs", sa.Column("dedup_removed", sa.Integer(), server_default="0", nullable=False))
    op.add_column("scrape_runs", sa.Column("scrape_mode", sa.String(length=20), nullable=True))
    op.add_column("scrape_runs", sa.Column("triggered_by", sa.String(length=10), nullable=True))
    op.add_column("scrape_runs", sa.Column("log_file", sa.String(length=255), nullable=True))
    op.add_column("scrape_runs", sa.Column("error_summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("scrape_runs", "error_summary")
    op.drop_column("scrape_runs", "log_file")
    op.drop_column("scrape_runs", "triggered_by")
    op.drop_column("scrape_runs", "scrape_mode")
    op.drop_column("scrape_runs", "dedup_removed")
    op.drop_column("scrape_runs", "completeness_by_source")
    op.drop_column("scrape_runs", "jobs_by_source")
    op.drop_column("scrape_runs", "sources_failed")
    op.drop_column("scrape_runs", "sources_succeeded")
    op.drop_column("scrape_runs", "sources_requested")
    op.drop_column("scrape_runs", "duration_seconds")
    op.drop_column("scrape_runs", "finished_at")
    op.drop_column("scrape_runs", "started_at")
