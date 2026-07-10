"""Unified skill gap agent endpoints.

POST /api/gap merges profile + market + latest interview + latest practice
into one report and saves it as a skill_gap_snapshots row (history kept).
POST /api/gap/market is the old market-only comparison, kept for callers that
only want CV-vs-Chroma without touching interview/practice data.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import get_settings
from app.db.models import SkillGapSnapshot, StudentProfile
from app.services.skill_gap import compute_combined_skill_gap, compute_market_gap, generate_gap_narrative, load_gap_context

router = APIRouter(prefix="/api", tags=["skill-gap"])


class CombinedGapRequest(BaseModel):
    profile_id: uuid.UUID
    interview_session_id: uuid.UUID | None = None
    practice_session_id: uuid.UUID | None = None
    include_narrative: bool | None = None
    n_jobs: int | None = Field(None, ge=1, le=100)


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    target_role: str
    interview_session_id: uuid.UUID | None
    practice_session_id: uuid.UUID | None
    jobs_analyzed: int
    match_ratio: float
    gap_data: dict
    narrative_summary: str | None
    created_at: datetime


class MarketGapRequest(BaseModel):
    profile_id: uuid.UUID | None = None
    skills: list[str] | None = None
    target_role: str | None = None


@router.post("/gap", response_model=SnapshotOut, status_code=201)
async def combined_gap(payload: CombinedGapRequest, db: AsyncSession = Depends(get_db)) -> SkillGapSnapshot:
    settings = get_settings()
    n_jobs = payload.n_jobs or settings.gap_n_jobs

    ctx = await load_gap_context(
        db,
        payload.profile_id,
        interview_session_id=payload.interview_session_id,
        practice_session_id=payload.practice_session_id,
        n_jobs=n_jobs,
    )
    if ctx is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    gap_data = compute_combined_skill_gap(ctx)

    include_narrative = payload.include_narrative
    if include_narrative is None:
        include_narrative = settings.gap_include_narrative_default
    narrative = await generate_gap_narrative(gap_data, ctx.profile) if include_narrative else None

    snapshot = SkillGapSnapshot(
        profile_id=ctx.profile.id,
        target_role=ctx.profile.target_role,
        interview_session_id=ctx.interview.id if ctx.interview else None,
        practice_session_id=ctx.practice.id if ctx.practice else None,
        jobs_analyzed=gap_data["jobs_analyzed"],
        match_ratio=gap_data["match_ratio"],
        gap_data=gap_data,
        narrative_summary=narrative,
    )
    db.add(snapshot)
    await db.commit()
    return snapshot


@router.post("/gap/market")
async def market_gap(payload: MarketGapRequest, db: AsyncSession = Depends(get_db)) -> dict:
    if payload.profile_id is not None:
        profile = await db.get(StudentProfile, payload.profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Profile not found")
        skills, target_role = profile.skills or [], profile.target_role
    elif payload.skills is not None and payload.target_role:
        skills, target_role = payload.skills, payload.target_role
    else:
        raise HTTPException(status_code=422, detail="Provide profile_id, or both skills and target_role")

    return compute_market_gap(skills, target_role, n_jobs=get_settings().gap_n_jobs)


@router.get("/gap/{profile_id}", response_model=SnapshotOut)
async def latest_gap(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> SkillGapSnapshot:
    result = await db.execute(
        select(SkillGapSnapshot)
        .where(SkillGapSnapshot.profile_id == profile_id)
        .order_by(SkillGapSnapshot.created_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="No skill gap snapshot yet — POST /api/gap first.")
    return snapshot


@router.get("/gap/{profile_id}/history", response_model=list[SnapshotOut])
async def gap_history(profile_id: uuid.UUID, limit: int = 10, db: AsyncSession = Depends(get_db)) -> list[SkillGapSnapshot]:
    result = await db.execute(
        select(SkillGapSnapshot)
        .where(SkillGapSnapshot.profile_id == profile_id)
        .order_by(SkillGapSnapshot.created_at.desc())
        .limit(min(limit, 50))
    )
    return list(result.scalars())
