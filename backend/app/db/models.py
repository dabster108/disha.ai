from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    """Auth is deferred; this table exists so profiles can attach to accounts later."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profiles: Mapped[list[StudentProfile]] = relationship(back_populates="user")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    summary: Mapped[str | None] = mapped_column(Text)
    years_of_experience: Mapped[float | None] = mapped_column(Float)
    education: Mapped[list] = mapped_column(JSONB, default=list)
    experience: Mapped[list] = mapped_column(JSONB, default=list)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list)
    skills_source: Mapped[str] = mapped_column(String(10), default="manual")  # 'manual' | 'cv'
    target_role: Mapped[str] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    time_per_week: Mapped[int | None] = mapped_column(Integer)  # hours available per week
    budget: Mapped[str | None] = mapped_column(String(100))  # e.g. "free", "NPR 5000/month"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User | None] = relationship(back_populates="profiles")
    roadmaps: Mapped[list[Roadmap]] = relationship(back_populates="profile")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    skill_gap: Mapped[dict] = mapped_column(JSONB, default=dict)
    weeks: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | completed | replanned
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[StudentProfile] = relationship(back_populates="roadmaps")


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sources: Mapped[list[str]] = mapped_column(JSONB, default=list)
    jobs_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="completed")  # running | completed | partial | failed
    detail: Mapped[str | None] = mapped_column(Text)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    sources_requested: Mapped[list | None] = mapped_column(JSONB)
    sources_succeeded: Mapped[list | None] = mapped_column(JSONB)
    sources_failed: Mapped[dict | None] = mapped_column(JSONB)
    jobs_by_source: Mapped[dict | None] = mapped_column(JSONB)
    completeness_by_source: Mapped[list | None] = mapped_column(JSONB)
    dedup_removed: Mapped[int] = mapped_column(Integer, default=0)
    scrape_mode: Mapped[str | None] = mapped_column(String(20))  # aggregator | direct | hybrid | custom
    triggered_by: Mapped[str | None] = mapped_column(String(10))  # cli | api
    log_file: Mapped[str | None] = mapped_column(String(255))
    error_summary: Mapped[str | None] = mapped_column(Text)
