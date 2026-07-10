"""Dashboard aggregator: one endpoint returning everything the dashboard and
journey pages need in a single round trip.

Consolidates the latest skill gap snapshot, latest roadmap, recent interview and
practice sessions, and real job matches (via the actual job-matching engine, not
the gap report's `sample_jobs`). Each section is computed independently so a
failure in one (e.g. job matching) never blocks the rest — the endpoint returns
partial data with an `error` flag per section.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.db.models import InterviewSession, PracticeSession, Roadmap, SkillGapSnapshot, StudentProfile
from app.services.job_matching import rank_jobs_for_student
from app.services.skill_gap import load_gap_context

logger = logging.getLogger("disha.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_JOB_MATCH_LIMIT = 6
DASHBOARD_HISTORY_LIMIT = 8
GAP_STALE_DAYS = 7


class TurnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    turn_index: int
    question: str
    answer: str | None
    score: float | None
    feedback: str | None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_role: str | None = None
    track: str | None = None
    difficulty: str | None = None
    status: str
    overall_score: float | None = None
    summary: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    turns: list[TurnOut] = Field(default_factory=list)


class PracticeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    skills_selected: list[str]
    status: str
    overall_score: float | None = None
    started_at: datetime
    finished_at: datetime | None = None


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_role: str
    jobs_analyzed: int
    match_ratio: float
    gap_data: dict
    narrative_summary: str | None
    created_at: datetime


class RoadmapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    weeks: list
    total_weeks: int | None
    summary: str | None
    path: dict | None = None
    progress: dict
    status: str
    created_at: datetime


class NextAction(BaseModel):
    key: str
    label: str
    description: str
    href: str
    priority: int


class DashboardResponse(BaseModel):
    profile_id: uuid.UUID
    target_role: str
    full_name: str | None

    gap: SnapshotOut | None = None
    gap_stale: bool = False
    gap_history: list[SnapshotOut] = Field(default_factory=list)
    roadmap: RoadmapOut | None = None
    job_matches: list[dict] = Field(default_factory=list)
    jobs_ok: bool = True
    interviews: list[SessionOut] = Field(default_factory=list)
    practices: list[PracticeOut] = Field(default_factory=list)
    next_action: NextAction


def _gap_is_stale(snapshot: SkillGapSnapshot | None) -> bool:
    if snapshot is None:
        return False
    age = datetime.now(timezone.utc) - snapshot.created_at
    return age.days > GAP_STALE_DAYS


def _compute_next_action(
    *,
    has_gap: bool,
    gap_stale: bool,
    has_completed_interview: bool,
    has_completed_practice: bool,
    roadmap,
) -> NextAction:
    """Rule-driven next action — highest-impact step first."""
    if not has_gap:
        return NextAction(
            key="run_gap",
            label="Run Skill Gap Analysis",
            description="See exactly where you stand against the live Nepal job market.",
            href="/skill-gap",
            priority=1,
        )
    if gap_stale:
        return NextAction(
            key="refresh_gap",
            label="Refresh Skill Gap",
            description="Your last analysis is over a week old — re-run to capture new postings and progress.",
            href="/skill-gap",
            priority=2,
        )
    if not has_completed_interview:
        return NextAction(
            key="interview",
            label="Take Mock Interview",
            description="Validate your skills in a real interview — it sharpens your readiness score.",
            href="/mock-interview",
            priority=3,
        )
    if not has_completed_practice:
        return NextAction(
            key="practice",
            label="Verify Skills",
            description="Run a practice session to prove your strongest skills with a passing challenge.",
            href="/practice",
            priority=4,
        )
    if roadmap is not None and roadmap.path:
        # Find the next incomplete skill node in the path.
        completed_nodes = set((roadmap.progress or {}).get("completed_nodes") or [])
        for phase in roadmap.path.get("phases") or []:
            for node in phase.get("nodes") or []:
                if node["id"] not in completed_nodes:
                    return NextAction(
                        key="continue_roadmap",
                        label=f"Learn next: {node.get('title') or node.get('skill')}",
                        description="Pick up your skill path where you left off.",
                        href="/roadmap",
                        priority=5,
                    )
    elif roadmap is not None:
        # Legacy week accordion — find the next incomplete task in the current week.
        completed = {(e["week"], e["task_index"]) for e in (roadmap.progress or {}).get("completed", [])}
        for week in roadmap.weeks or []:
            for i, task in enumerate(week.get("tasks") or []):
                if (week["week"], i) not in completed:
                    return NextAction(
                        key="continue_roadmap",
                        label=f"Continue Week {week['week']}: {task.get('title') or task.get('skill') or 'next task'}",
                        description="Pick up your roadmap where you left off.",
                        href="/roadmap",
                        priority=5,
                    )
    return NextAction(
        key="explore_jobs",
        label="Explore Job Matches",
        description="Your profile is in strong shape — check the latest roles matched to you.",
        href="/jobs",
        priority=6,
    )


@router.get("/{profile_id}", response_model=DashboardResponse)
async def get_dashboard(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Latest gap snapshot + history, in one query.
    gap_rows = (
        await db.execute(
            select(SkillGapSnapshot)
            .where(SkillGapSnapshot.profile_id == profile_id)
            .order_by(SkillGapSnapshot.created_at.desc())
            .limit(DASHBOARD_HISTORY_LIMIT)
        )
    ).scalars().all()
    latest_gap = gap_rows[0] if gap_rows else None
    gap_stale = _gap_is_stale(latest_gap)

    # Latest active roadmap.
    roadmap_row = (
        await db.execute(
            select(Roadmap)
            .where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
            .order_by(Roadmap.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    # Interview sessions (with turns) + practice sessions.
    interview_rows = (
        await db.execute(
            select(InterviewSession)
            .options(selectinload(InterviewSession.turns))
            .where(InterviewSession.profile_id == profile_id)
            .order_by(InterviewSession.started_at.desc())
            .limit(10)
        )
    ).scalars().all()

    practice_rows = (
        await db.execute(
            select(PracticeSession)
            .where(PracticeSession.profile_id == profile_id)
            .order_by(PracticeSession.started_at.desc())
            .limit(10)
        )
    ).scalars().all()

    has_completed_interview = any(s.status == "completed" for s in interview_rows)
    has_completed_practice = any(s.status == "completed" for s in practice_rows)

    # Real job matches via the job-matching engine (reuses the gap context's
    # single Chroma search). Failures degrade gracefully — the dashboard still
    # renders from `gap_data.sample_jobs` as a fallback.
    job_matches: list[dict] = []
    jobs_ok = True
    try:
        ctx = await load_gap_context(db, profile_id)
        if ctx is not None:
            job_matches = rank_jobs_for_student(ctx, n=DASHBOARD_JOB_MATCH_LIMIT)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Dashboard job matching failed: %s", exc, exc_info=True)
        jobs_ok = False
        # Fall back to the snapshot's sample jobs so the dashboard never blanks.
        if latest_gap is not None:
            job_matches = list(latest_gap.gap_data.get("sample_jobs") or [])

    next_action = _compute_next_action(
        has_gap=latest_gap is not None,
        gap_stale=gap_stale,
        has_completed_interview=has_completed_interview,
        has_completed_practice=has_completed_practice,
        roadmap=roadmap_row,
    )

    return DashboardResponse(
        profile_id=profile_id,
        target_role=profile.target_role,
        full_name=profile.full_name,
        gap=SnapshotOut.model_validate(latest_gap) if latest_gap else None,
        gap_stale=gap_stale,
        gap_history=[SnapshotOut.model_validate(s) for s in gap_rows],
        roadmap=RoadmapOut.model_validate(roadmap_row) if roadmap_row else None,
        job_matches=job_matches,
        jobs_ok=jobs_ok,
        interviews=[
            SessionOut(
                id=s.id,
                target_role=s.target_role,
                track=s.track,
                difficulty=s.difficulty,
                status=s.status,
                overall_score=s.overall_score,
                summary=s.summary,
                started_at=s.started_at,
                finished_at=s.finished_at,
                turns=[
                    TurnOut(turn_index=t.turn_index, question=t.question, answer=t.answer, score=t.score, feedback=t.feedback)
                    for t in sorted(s.turns, key=lambda x: x.turn_index)
                ],
            )
            for s in interview_rows
        ],
        practices=[
            PracticeOut(
                id=p.id,
                skills_selected=list(p.skills_selected or []),
                status=p.status,
                overall_score=p.overall_score,
                started_at=p.started_at,
                finished_at=p.finished_at,
            )
            for p in practice_rows
        ],
        next_action=next_action,
    )
