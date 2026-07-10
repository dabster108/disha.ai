from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.services.job_matching import rank_jobs_for_student
from app.services.skill_gap import load_gap_context

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobMatchRequest(BaseModel):
    profile_id: uuid.UUID
    n: int | None = Field(default=None, ge=1, le=20)


class JobMatchResponse(BaseModel):
    profile_id: uuid.UUID
    target_role: str
    jobs_analyzed: int
    matches: list[dict]


@router.post("/match", response_model=JobMatchResponse)
async def match_jobs(payload: JobMatchRequest, db: AsyncSession = Depends(get_db)) -> JobMatchResponse:
    ctx = await load_gap_context(db, payload.profile_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    matches = rank_jobs_for_student(ctx, n=payload.n)
    return JobMatchResponse(
        profile_id=payload.profile_id,
        target_role=ctx.profile.target_role,
        jobs_analyzed=ctx.n_jobs,
        matches=matches,
    )


@router.get("/match/{profile_id}", response_model=JobMatchResponse)
async def get_job_matches(
    profile_id: uuid.UUID,
    n: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> JobMatchResponse:
    ctx = await load_gap_context(db, profile_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    matches = rank_jobs_for_student(ctx, n=n)
    return JobMatchResponse(
        profile_id=profile_id,
        target_role=ctx.profile.target_role,
        jobs_analyzed=ctx.n_jobs,
        matches=matches,
    )
