"""Cross-profile activity leaderboard — who has done what and how they score."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models import InterviewSession, PracticeSession, Roadmap, SkillGapSnapshot, StudentProfile

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


class LeaderboardEntry(BaseModel):
    profile_id: uuid.UUID
    full_name: str
    target_role: str
    readiness_score: float | None = None
    interview_count: int = 0
    interview_best: float | None = None
    interview_avg: float | None = None
    practice_count: int = 0
    practice_best: float | None = None
    practice_avg: float | None = None
    has_gap: bool = False
    has_roadmap: bool = False
    composite_score: float = 0
    activities: list[str] = Field(default_factory=list)
    last_active_at: datetime | None = None


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    your_rank: int | None = None


def _compute_composite(
    readiness: float | None,
    interview_avg: float | None,
    practice_avg: float | None,
    activities: list[str],
) -> float:
    """Blend readiness (0–100), interview/practice (0–10), plus activity bonus."""
    r = (readiness or 0) / 10
    i = interview_avg or 0
    p = practice_avg or 0
    activity_bonus = min(len(activities) * 0.4, 2.0)
    if r == 0 and i == 0 and p == 0 and not activities:
        return 0.0
    base = r * 0.45 + i * 0.275 + p * 0.275
    return round(min(base + activity_bonus, 10), 1)


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    profile_id: uuid.UUID | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    limit = min(max(limit, 1), 100)

    profiles = (
        await db.execute(select(StudentProfile).order_by(StudentProfile.created_at.desc()).limit(200))
    ).scalars().all()
    if not profiles:
        return LeaderboardResponse(entries=[], your_rank=None)

    profile_ids = [p.id for p in profiles]

    # Latest gap snapshot per profile (readiness).
    gap_rows = (
        await db.execute(
            select(SkillGapSnapshot)
            .where(SkillGapSnapshot.profile_id.in_(profile_ids))
            .order_by(SkillGapSnapshot.profile_id, SkillGapSnapshot.created_at.desc())
        )
    ).scalars().all()
    latest_gap: dict[uuid.UUID, SkillGapSnapshot] = {}
    for row in gap_rows:
        if row.profile_id not in latest_gap:
            latest_gap[row.profile_id] = row

    # Interview stats.
    interview_rows = (
        await db.execute(
            select(
                InterviewSession.profile_id,
                func.count(InterviewSession.id).label("cnt"),
                func.max(InterviewSession.overall_score).label("best"),
                func.avg(InterviewSession.overall_score).label("avg"),
                func.max(InterviewSession.finished_at).label("last"),
            )
            .where(
                InterviewSession.profile_id.in_(profile_ids),
                InterviewSession.status == "completed",
            )
            .group_by(InterviewSession.profile_id)
        )
    ).all()
    interview_map = {r.profile_id: r for r in interview_rows}

    # Practice stats.
    practice_rows = (
        await db.execute(
            select(
                PracticeSession.profile_id,
                func.count(PracticeSession.id).label("cnt"),
                func.max(PracticeSession.overall_score).label("best"),
                func.avg(PracticeSession.overall_score).label("avg"),
                func.max(PracticeSession.finished_at).label("last"),
            )
            .where(
                PracticeSession.profile_id.in_(profile_ids),
                PracticeSession.status == "completed",
            )
            .group_by(PracticeSession.profile_id)
        )
    ).all()
    practice_map = {r.profile_id: r for r in practice_rows}

    # Active roadmaps.
    roadmap_rows = (
        await db.execute(
            select(Roadmap.profile_id, func.max(Roadmap.created_at).label("last"))
            .where(Roadmap.profile_id.in_(profile_ids), Roadmap.status == "active")
            .group_by(Roadmap.profile_id)
        )
    ).all()
    roadmap_set = {r.profile_id for r in roadmap_rows}
    roadmap_last = {r.profile_id: r.last for r in roadmap_rows}

    entries: list[LeaderboardEntry] = []
    for p in profiles:
        gap = latest_gap.get(p.id)
        readiness = gap.gap_data.get("readiness_score") if gap and gap.gap_data else None
        iv = interview_map.get(p.id)
        pr = practice_map.get(p.id)

        activities: list[str] = []
        if gap:
            activities.append("Skill gap")
        if p.id in roadmap_set:
            activities.append("Roadmap")
        if iv and iv.cnt:
            activities.append(f"{iv.cnt} interview{'s' if iv.cnt != 1 else ''}")
        if pr and pr.cnt:
            activities.append(f"{pr.cnt} practice{'s' if pr.cnt != 1 else ''}")

        last_times = [
            t
            for t in [
                gap.created_at if gap else None,
                iv.last if iv else None,
                pr.last if pr else None,
                roadmap_last.get(p.id),
            ]
            if t is not None
        ]

        entries.append(
            LeaderboardEntry(
                profile_id=p.id,
                full_name=p.full_name or "Anonymous",
                target_role=p.target_role,
                readiness_score=readiness,
                interview_count=int(iv.cnt) if iv else 0,
                interview_best=round(iv.best, 1) if iv and iv.best is not None else None,
                interview_avg=round(iv.avg, 1) if iv and iv.avg is not None else None,
                practice_count=int(pr.cnt) if pr else 0,
                practice_best=round(pr.best, 1) if pr and pr.best is not None else None,
                practice_avg=round(pr.avg, 1) if pr and pr.avg is not None else None,
                has_gap=gap is not None,
                has_roadmap=p.id in roadmap_set,
                activities=activities,
                last_active_at=max(last_times) if last_times else p.created_at,
                composite_score=_compute_composite(
                    readiness,
                    round(iv.avg, 1) if iv and iv.avg is not None else None,
                    round(pr.avg, 1) if pr and pr.avg is not None else None,
                    activities,
                ),
            )
        )

    # Rank by composite score, then activity count, then readiness.
    entries.sort(
        key=lambda e: (
            e.composite_score,
            len(e.activities),
            e.readiness_score or 0,
            e.interview_count + e.practice_count,
        ),
        reverse=True,
    )

    your_rank = None
    if profile_id:
        for i, e in enumerate(entries, start=1):
            if e.profile_id == profile_id:
                your_rank = i
                break

    entries = entries[:limit]

    return LeaderboardResponse(entries=entries, your_rank=your_rank)
