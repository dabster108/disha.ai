from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
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
    profile_meta: Mapped[dict] = mapped_column(JSONB, default=dict)  # extended profile sections (projects, portfolio, etc.)
    settings_meta: Mapped[dict] = mapped_column(JSONB, default=dict)  # per-user app settings
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User | None] = relationship(back_populates="profiles")
    roadmaps: Mapped[list[Roadmap]] = relationship(back_populates="profile")
    interview_sessions: Mapped[list[InterviewSession]] = relationship(back_populates="profile")
    practice_sessions: Mapped[list[PracticeSession]] = relationship(back_populates="profile")
    skill_gap_snapshots: Mapped[list[SkillGapSnapshot]] = relationship(back_populates="profile")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    snapshot_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skill_gap_snapshots.id"), nullable=True)
    skill_gap: Mapped[dict] = mapped_column(JSONB, default=dict)
    weeks: Mapped[list] = mapped_column(JSONB, default=list)
    total_weeks: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    # roadmap.sh-style full skill path: {"schema_version": 1, "summary": ..., "phases": [{"id", "title", "nodes": [...]}]}.
    # Nullable — legacy roadmaps generated before this feature have weeks only.
    path: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    progress: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"completed": [{"week":1,"task_index":0}, ...], "completed_nodes": [...]}
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | completed | replanned
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[StudentProfile] = relationship(back_populates="roadmaps")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    target_role: Mapped[str] = mapped_column(String(255))
    track: Mapped[str] = mapped_column(String(20))  # tech | nontech
    difficulty: Mapped[str] = mapped_column(String(10))  # easy | medium | hard
    status: Mapped[str] = mapped_column(String(20), default="started")  # started | completed
    overall_score: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list | None] = mapped_column(JSONB)
    weaknesses: Mapped[list | None] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile: Mapped[StudentProfile] = relationship(back_populates="interview_sessions")
    turns: Mapped[list[InterviewTurn]] = relationship(
        back_populates="session",
        order_by="InterviewTurn.turn_index",
        cascade="all, delete-orphan",
    )


class InterviewTurn(Base):
    __tablename__ = "interview_turns"
    __table_args__ = (UniqueConstraint("session_id", "turn_index", name="uq_interview_turns_session_turn_index"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id"))
    turn_index: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(20))  # opening | technical | conceptual | scenario | behavioral
    skill_tag: Mapped[str | None] = mapped_column(String(100))
    difficulty: Mapped[str] = mapped_column(String(10))
    score: Mapped[float | None] = mapped_column(Float)
    feedback: Mapped[str | None] = mapped_column(Text)
    dimensions: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[InterviewSession] = relationship(back_populates="turns")


class PracticeSession(Base):
    """Skill-practice / game session — one coding or scenario challenge per chosen skill.

    Distinct from InterviewSession: interviews are whole-profile adaptive Q&A;
    practice verifies individual skills with a pass/fail threshold.
    """

    __tablename__ = "practice_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    target_role: Mapped[str] = mapped_column(String(255))
    track: Mapped[str] = mapped_column(String(20))  # tech | nontech
    difficulty: Mapped[str] = mapped_column(String(10))  # easy | medium | hard
    skills_selected: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="started")  # started | completed
    overall_score: Mapped[float | None] = mapped_column(Float)
    pass_threshold: Mapped[float] = mapped_column(Float, default=7.0)
    verified_strong_skills: Mapped[list | None] = mapped_column(JSONB)
    verified_weak_skills: Mapped[list | None] = mapped_column(JSONB)
    skill_scores: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile: Mapped[StudentProfile] = relationship(back_populates="practice_sessions")
    challenges: Mapped[list[PracticeChallenge]] = relationship(
        back_populates="session",
        order_by="PracticeChallenge.challenge_index",
        cascade="all, delete-orphan",
    )


class PracticeChallenge(Base):
    __tablename__ = "practice_challenges"
    __table_args__ = (UniqueConstraint("session_id", "challenge_index", name="uq_practice_challenge_order"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_sessions.id"))
    challenge_index: Mapped[int] = mapped_column(Integer)  # 0-based order in session
    skill: Mapped[str] = mapped_column(String(100))
    challenge_type: Mapped[str] = mapped_column(String(20))  # coding | scenario
    difficulty: Mapped[str] = mapped_column(String(10))
    prompt: Mapped[str] = mapped_column(Text)
    starter_code: Mapped[str | None] = mapped_column(Text)
    expected_language: Mapped[str | None] = mapped_column(String(30))  # python | javascript | sql | null
    evaluation_hints: Mapped[list | None] = mapped_column(JSONB)
    answer_code: Mapped[str | None] = mapped_column(Text)
    answer_text: Mapped[str | None] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    score: Mapped[float | None] = mapped_column(Float)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    verified_skill_level: Mapped[str | None] = mapped_column(String(10))  # weak | partial | strong
    feedback: Mapped[str | None] = mapped_column(Text)
    dimensions: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[PracticeSession] = relationship(back_populates="challenges")


class SkillGapSnapshot(Base):
    """Point-in-time merge of profile + market + interview + practice signals.

    Multiple snapshots per profile are kept (history); the gap API returns the
    latest by default. ``gap_data`` is the full computed payload (see
    app/services/skill_gap.py) — the flattened columns exist for fast filtering.
    """

    __tablename__ = "skill_gap_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    target_role: Mapped[str] = mapped_column(String(255))
    interview_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("interview_sessions.id"), nullable=True)
    practice_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("practice_sessions.id"), nullable=True)
    jobs_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    match_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    gap_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    narrative_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[StudentProfile] = relationship(back_populates="skill_gap_snapshots")


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
