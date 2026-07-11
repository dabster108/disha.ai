from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import get_settings
from app.services import synthetic_recommender
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


class JobCorpusStatus(BaseModel):
    jobs_file_exists: bool
    jobs_file_count: int
    chroma_count: int
    ready: bool
    message: str


def _corpus_status() -> JobCorpusStatus:
    settings = get_settings()
    jobs_count = 0
    if settings.jobs_file.exists():
        import json

        jobs_count = len(json.loads(settings.jobs_file.read_text(encoding="utf-8")).get("jobs", []))

    chroma_count = 0
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(settings.chroma_path))
        collection = client.get_collection(settings.chroma_collection)
        chroma_count = collection.count()
    except Exception:
        chroma_count = 0

    ready = chroma_count > 0
    if not settings.jobs_file.exists() and chroma_count == 0:
        message = (
            "Job corpus is empty. Run: uv run python -m scripts.seed_jobs && "
            "uv run python -m app.rag.ingest --reset  (or scripts/refresh_jobs.ps1 for live scrape)."
        )
    elif jobs_count > 0 and chroma_count == 0:
        message = f"Found {jobs_count} jobs in jobs.json but Chroma is empty — run: uv run python -m app.rag.ingest --reset"
    elif chroma_count > 0:
        message = f"Corpus ready with {chroma_count} indexed jobs."
    else:
        message = "Job corpus unavailable."

    return JobCorpusStatus(
        jobs_file_exists=settings.jobs_file.exists(),
        jobs_file_count=jobs_count,
        chroma_count=chroma_count,
        ready=ready,
        message=message,
    )


@router.get("/status", response_model=JobCorpusStatus)
async def job_corpus_status() -> JobCorpusStatus:
    return _corpus_status()


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


# ---------------------------------------------------------------------------
# Synthetic Recommendation Lab — demo/benchmark only, separate from the real
# Nepal job corpus above. See app/services/synthetic_recommender.py.
# ---------------------------------------------------------------------------


class SyntheticRecommendRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    top_k: int = Field(default=10, ge=1, le=50)


class SyntheticEvalRequest(BaseModel):
    sample_n: int = Field(default=500, ge=10, le=5000)


class SyntheticJobMatch(BaseModel):
    job_id: str
    job_requirements: str
    our_score: float
    dataset_match_score: float | None
    dataset_recommended: bool
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str


class SyntheticRecommendResponse(BaseModel):
    matches: list[SyntheticJobMatch]
    reason: str | None = None


class SyntheticEvalResponse(BaseModel):
    sample_size: int
    mae: float | None
    precision_when_recommended: float | None
    note: str


@router.post("/synthetic-recommend", response_model=SyntheticRecommendResponse)
async def synthetic_recommend(payload: SyntheticRecommendRequest) -> dict:
    try:
        return synthetic_recommender.recommend(payload.skills, top_k=payload.top_k)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/synthetic-eval", response_model=SyntheticEvalResponse)
async def synthetic_eval(payload: SyntheticEvalRequest) -> dict:
    try:
        return synthetic_recommender.evaluate(sample_n=payload.sample_n)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
