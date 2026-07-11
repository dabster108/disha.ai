"""Admin endpoints: trigger scrape runs and inspect their history.

Protected by the X-Admin-Key header (ADMIN_API_KEY in .env). The scrape runs
as an in-process background task — one at a time — and optionally re-ingests
Chroma when it finishes.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.config import get_settings
from app.db.models import (
    InterviewSession,
    LearningCurriculum,
    PracticeSession,
    Roadmap,
    ScrapeRun,
    SkillGapSnapshot,
    StudentProfile,
)
from app.api.routes.interview import InterviewSessionOut
from app.db.session import async_session_factory
from app.services.job_matching import rank_jobs_for_student
from app.services.master_roadmap import (
    MasterRoadmapDocument,
    list_available_roadmaps,
    list_master_roadmap_registry,
    load_master_document,
    save_master_document,
    scaffold_master_document,
    validate_master_document,
)
from app.services.roadmap import compute_roadmap_progress_pct
from app.services.skill_gap import load_gap_context
from scraper.scraper import MODES, SOURCES

router = APIRouter(prefix="/api/admin", tags=["admin"])

_scrape_lock = asyncio.Lock()


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key header")


class ScrapeRequest(BaseModel):
    mode: Literal["aggregator", "direct", "hybrid"] = "hybrid"
    sources: list[str] | None = Field(None, description="Override mode with explicit sources")
    max_per_source: int | None = Field(100, ge=1, le=2000)
    reingest_chroma: bool = True
    # DISHA targets IT careers — prefer tech category/search feeds by default.
    tech_focus: bool = True


class ScrapeTriggerResponse(BaseModel):
    scrape_run_id: uuid.UUID
    status: str


class SourceCompleteness(BaseModel):
    source: str
    jobs: int
    skills_pct: int
    salary_pct: int
    location_pct: int
    completeness: int


class SourceRankingResponse(BaseModel):
    scrape_run_id: uuid.UUID
    scraped_at: datetime
    ranking: list[SourceCompleteness]


class ScrapeRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    scrape_mode: str | None
    triggered_by: str | None
    jobs_count: int
    dedup_removed: int
    sources_requested: list | None
    sources_succeeded: list | None
    sources_failed: dict | None
    jobs_by_source: dict | None
    completeness_by_source: list | None
    started_at: datetime | None
    finished_at: datetime | None
    duration_seconds: float | None
    log_file: str | None
    error_summary: str | None


async def _run_scrape_background(run_id: uuid.UUID, request: ScrapeRequest) -> None:
    from scraper.run import execute_scrape_run

    try:
        async with _scrape_lock:
            summary = await execute_scrape_run(
                mode=request.mode,
                sources=request.sources,
                max_per_source=request.max_per_source,
                log_db=True,
                log_file=True,
                triggered_by="api",
                run_id=run_id,
                tech_focus=request.tech_focus,
            )
        if request.reingest_chroma and summary["status"] != "failed":
            from app.rag.ingest import ingest

            await asyncio.to_thread(ingest, reset=True)
    except Exception as exc:
        async with async_session_factory() as session:
            run = await session.get(ScrapeRun, run_id)
            if run is not None:
                run.status = "failed"
                run.error_summary = f"{type(exc).__name__}: {exc}"
                await session.commit()


@router.post("/scrape", response_model=ScrapeTriggerResponse, status_code=202, dependencies=[Depends(require_admin)])
async def trigger_scrape(request: ScrapeRequest) -> dict:
    if request.sources:
        unknown = [s for s in request.sources if s not in SOURCES]
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown sources: {unknown}. Available: {list(SOURCES)}")

    if _scrape_lock.locked():
        raise HTTPException(status_code=409, detail="A scrape is already running")

    async with async_session_factory() as session:
        run = ScrapeRun(
            status="running",
            scrape_mode=request.mode if request.sources is None else "custom",
            triggered_by="api",
            sources_requested=request.sources or MODES[request.mode],
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    asyncio.create_task(_run_scrape_background(run_id, request))
    return {"scrape_run_id": str(run_id), "status": "running"}


@router.get("/scrape/runs", response_model=list[ScrapeRunOut], dependencies=[Depends(require_admin)])
async def list_runs(limit: int = 20, db: AsyncSession = Depends(get_db)) -> list[ScrapeRun]:
    result = await db.execute(
        select(ScrapeRun).order_by(ScrapeRun.scraped_at.desc()).limit(min(limit, 100))
    )
    return list(result.scalars())


@router.get("/scrape/sources/ranking", response_model=SourceRankingResponse, dependencies=[Depends(require_admin)])
async def source_ranking(db: AsyncSession = Depends(get_db)) -> dict:
    """Latest completed run's per-source completeness, best first."""
    result = await db.execute(
        select(ScrapeRun)
        .where(ScrapeRun.status.in_(["completed", "partial"]))
        .order_by(ScrapeRun.scraped_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if run is None or not run.completeness_by_source:
        raise HTTPException(status_code=404, detail="No completed scrape runs with stats yet")
    return {
        "scrape_run_id": str(run.id),
        "scraped_at": run.scraped_at,
        "ranking": run.completeness_by_source,
    }


@router.get("/scrape/{scrape_run_id}", response_model=ScrapeRunOut, dependencies=[Depends(require_admin)])
async def get_run(scrape_run_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ScrapeRun:
    run = await db.get(ScrapeRun, scrape_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Scrape run not found")
    return run


# ---------------------------------------------------------------------------
# Admin dashboard — stats, user list, per-user verification dossier.
# Read-only aggregation of existing tables/services; no new business logic.
# ---------------------------------------------------------------------------


class AdminStats(BaseModel):
    profile_count: int
    gap_run_count: int
    interview_count: int
    interview_completed_count: int
    practice_count: int
    practice_completed_count: int
    sessions_today: int
    latest_scrape: ScrapeRunOut | None
    jobs_indexed: int


@router.get("/stats", response_model=AdminStats, dependencies=[Depends(require_admin)])
async def admin_stats(db: AsyncSession = Depends(get_db)) -> AdminStats:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    profile_count = (await db.execute(select(func.count(StudentProfile.id)))).scalar_one()
    gap_run_count = (await db.execute(select(func.count(SkillGapSnapshot.id)))).scalar_one()
    interview_count = (await db.execute(select(func.count(InterviewSession.id)))).scalar_one()
    interview_completed_count = (
        await db.execute(select(func.count(InterviewSession.id)).where(InterviewSession.status == "completed"))
    ).scalar_one()
    practice_count = (await db.execute(select(func.count(PracticeSession.id)))).scalar_one()
    practice_completed_count = (
        await db.execute(select(func.count(PracticeSession.id)).where(PracticeSession.status == "completed"))
    ).scalar_one()

    sessions_today = (
        await db.execute(
            select(func.count(InterviewSession.id)).where(InterviewSession.started_at >= today_start)
        )
    ).scalar_one() + (
        await db.execute(
            select(func.count(PracticeSession.id)).where(PracticeSession.started_at >= today_start)
        )
    ).scalar_one()

    latest_run = (
        await db.execute(select(ScrapeRun).order_by(ScrapeRun.scraped_at.desc()).limit(1))
    ).scalar_one_or_none()

    from app.config import get_settings as _get_settings

    settings = _get_settings()
    jobs_indexed = 0
    if settings.jobs_file.exists():
        import json

        jobs_indexed = len(json.loads(settings.jobs_file.read_text(encoding="utf-8")).get("jobs", []))

    return AdminStats(
        profile_count=profile_count,
        gap_run_count=gap_run_count,
        interview_count=interview_count,
        interview_completed_count=interview_completed_count,
        practice_count=practice_count,
        practice_completed_count=practice_completed_count,
        sessions_today=sessions_today,
        latest_scrape=latest_run,
        jobs_indexed=jobs_indexed,
    )


class AdminUserSummary(BaseModel):
    id: uuid.UUID
    full_name: str | None
    email: str | None
    target_role: str
    created_at: datetime
    readiness_score: float | None = None
    has_gap: bool = False
    has_interview: bool = False
    has_practice: bool = False
    has_roadmap: bool = False
    verification_status: str | None = None


@router.get("/users", response_model=list[AdminUserSummary], dependencies=[Depends(require_admin)])
async def admin_list_users(
    limit: int = 50, q: str | None = None, db: AsyncSession = Depends(get_db)
) -> list[AdminUserSummary]:
    limit = min(max(limit, 1), 200)
    query = select(StudentProfile).order_by(StudentProfile.created_at.desc()).limit(limit)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(StudentProfile.full_name.ilike(pattern), StudentProfile.email.ilike(pattern), StudentProfile.target_role.ilike(pattern))
        )
    profiles = (await db.execute(query)).scalars().all()
    if not profiles:
        return []

    profile_ids = [p.id for p in profiles]

    gap_rows = (
        await db.execute(
            select(SkillGapSnapshot)
            .where(SkillGapSnapshot.profile_id.in_(profile_ids))
            .order_by(SkillGapSnapshot.profile_id, SkillGapSnapshot.created_at.desc())
        )
    ).scalars().all()
    latest_gap: dict[uuid.UUID, SkillGapSnapshot] = {}
    for row in gap_rows:
        latest_gap.setdefault(row.profile_id, row)

    interview_profiles = set(
        (await db.execute(select(InterviewSession.profile_id).where(InterviewSession.profile_id.in_(profile_ids)))).scalars()
    )
    practice_profiles = set(
        (await db.execute(select(PracticeSession.profile_id).where(PracticeSession.profile_id.in_(profile_ids)))).scalars()
    )
    roadmap_profiles = set(
        (await db.execute(select(Roadmap.profile_id).where(Roadmap.profile_id.in_(profile_ids)))).scalars()
    )

    out: list[AdminUserSummary] = []
    for p in profiles:
        gap = latest_gap.get(p.id)
        out.append(
            AdminUserSummary(
                id=p.id,
                full_name=p.full_name,
                email=p.email,
                target_role=p.target_role,
                created_at=p.created_at,
                readiness_score=gap.gap_data.get("readiness_score") if gap and gap.gap_data else None,
                has_gap=gap is not None,
                has_interview=p.id in interview_profiles,
                has_practice=p.id in practice_profiles,
                has_roadmap=p.id in roadmap_profiles,
                verification_status=(p.profile_meta or {}).get("admin_verification", {}).get("status"),
            )
        )
    return out


class AdminUserDossier(BaseModel):
    profile: dict
    gap: dict | None
    interviews: list[dict]
    practices: list[dict]
    roadmap: dict | None
    roadmap_pct: float
    job_matches: list[dict]
    category_scores: dict[str, float]
    verification: dict


def _profile_to_dict(p: StudentProfile) -> dict:
    return {
        "id": str(p.id),
        "full_name": p.full_name,
        "email": p.email,
        "phone": p.phone,
        "summary": p.summary,
        "target_role": p.target_role,
        "location": p.location,
        "years_of_experience": p.years_of_experience,
        "skills": p.skills,
        "skills_source": p.skills_source,
        "education": p.education,
        "experience": p.experience,
        "time_per_week": p.time_per_week,
        "budget": p.budget,
        "created_at": p.created_at.isoformat(),
    }


@router.get("/users/{profile_id}", response_model=AdminUserDossier, dependencies=[Depends(require_admin)])
async def admin_user_dossier(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> AdminUserDossier:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    gap_row = (
        await db.execute(
            select(SkillGapSnapshot)
            .where(SkillGapSnapshot.profile_id == profile_id)
            .order_by(SkillGapSnapshot.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    interviews = (
        await db.execute(
            select(InterviewSession)
            .options(selectinload(InterviewSession.turns))
            .where(InterviewSession.profile_id == profile_id)
            .order_by(InterviewSession.started_at.desc())
            .limit(10)
        )
    ).scalars().all()

    practices = (
        await db.execute(
            select(PracticeSession)
            .where(PracticeSession.profile_id == profile_id)
            .order_by(PracticeSession.started_at.desc())
            .limit(10)
        )
    ).scalars().all()

    roadmap = (
        await db.execute(
            select(Roadmap)
            .where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
            .order_by(Roadmap.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    job_matches: list[dict] = []
    try:
        ctx = await load_gap_context(db, profile_id)
        if ctx is not None:
            job_matches = rank_jobs_for_student(ctx, n=5)
    except Exception:
        job_matches = []

    completed_interviews = [s for s in interviews if s.status == "completed" and s.overall_score is not None]
    completed_practices = [s for s in practices if s.status == "completed" and s.overall_score is not None]
    interview_avg = (
        round(sum(s.overall_score for s in completed_interviews) / len(completed_interviews), 1)
        if completed_interviews
        else 0
    )
    practice_avg = (
        round(sum(s.overall_score for s in completed_practices) / len(completed_practices), 1)
        if completed_practices
        else 0
    )
    readiness = gap_row.gap_data.get("readiness_score") if gap_row and gap_row.gap_data else None
    roadmap_pct = compute_roadmap_progress_pct(roadmap)

    return AdminUserDossier(
        profile=_profile_to_dict(profile),
        gap={
            "id": str(gap_row.id),
            "target_role": gap_row.target_role,
            "jobs_analyzed": gap_row.jobs_analyzed,
            "match_ratio": gap_row.match_ratio,
            "gap_data": gap_row.gap_data,
            "narrative_summary": gap_row.narrative_summary,
            "created_at": gap_row.created_at.isoformat(),
        }
        if gap_row
        else None,
        interviews=[
            {
                "id": str(s.id),
                "status": s.status,
                "overall_score": s.overall_score,
                "summary": s.summary,
                "strengths": s.strengths,
                "weaknesses": s.weaknesses,
                "started_at": s.started_at.isoformat(),
                "turn_count": len(s.turns),
            }
            for s in interviews
        ],
        practices=[
            {
                "id": str(s.id),
                "status": s.status,
                "skills_selected": s.skills_selected,
                "overall_score": s.overall_score,
                "verified_strong_skills": s.verified_strong_skills,
                "verified_weak_skills": s.verified_weak_skills,
                "started_at": s.started_at.isoformat(),
            }
            for s in practices
        ],
        roadmap={
            "id": str(roadmap.id),
            "total_weeks": roadmap.total_weeks,
            "status": roadmap.status,
            "created_at": roadmap.created_at.isoformat(),
        }
        if roadmap
        else None,
        roadmap_pct=roadmap_pct,
        job_matches=job_matches,
        category_scores={
            "interview": interview_avg,
            "practice": practice_avg,
            "skill_gap": round(readiness, 1) if readiness is not None else 0,
            "roadmap": roadmap_pct,
        },
        verification=(profile.profile_meta or {}).get(
            "admin_verification", {"status": "unreviewed", "notes": ""}
        ),
    )


class VerificationUpdate(BaseModel):
    status: Literal["verified", "needs_review", "flagged", "unreviewed"]
    notes: str = ""


class VerificationOut(BaseModel):
    status: Literal["verified", "needs_review", "flagged", "unreviewed"]
    notes: str
    updated_at: datetime


@router.patch("/users/{profile_id}/verification", response_model=VerificationOut, dependencies=[Depends(require_admin)])
async def update_verification(
    profile_id: uuid.UUID, payload: VerificationUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    meta = dict(profile.profile_meta or {})
    meta["admin_verification"] = {
        "status": payload.status,
        "notes": payload.notes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    profile.profile_meta = meta
    await db.commit()
    return meta["admin_verification"]


# ---------------------------------------------------------------------------
# Cross-user browsing: interviews (with full report detail), practice, gaps,
# roadmaps. Read-only, reuses the exact schemas the student-facing routes
# already return — an admin sees the same report a student would, never a
# separate re-derived view.
# ---------------------------------------------------------------------------


class AdminInterviewSummary(BaseModel):
    id: uuid.UUID
    profile_id: uuid.UUID
    full_name: str | None
    target_role: str
    track: str
    status: str
    overall_score: float | None
    started_at: datetime
    finished_at: datetime | None
    turn_count: int


@router.get("/interviews", response_model=list[AdminInterviewSummary], dependencies=[Depends(require_admin)])
async def admin_list_interviews(
    profile_id: uuid.UUID | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AdminInterviewSummary]:
    limit = min(max(limit, 1), 200)
    query = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .order_by(InterviewSession.started_at.desc())
        .limit(limit)
    )
    if profile_id is not None:
        query = query.where(InterviewSession.profile_id == profile_id)
    sessions = (await db.execute(query)).scalars().all()
    if not sessions:
        return []

    profiles = (
        await db.execute(select(StudentProfile).where(StudentProfile.id.in_({s.profile_id for s in sessions})))
    ).scalars().all()
    names = {p.id: p.full_name for p in profiles}

    return [
        AdminInterviewSummary(
            id=s.id,
            profile_id=s.profile_id,
            full_name=names.get(s.profile_id),
            target_role=s.target_role,
            track=s.track,
            status=s.status,
            overall_score=s.overall_score,
            started_at=s.started_at,
            finished_at=s.finished_at,
            turn_count=len(s.turns),
        )
        for s in sessions
    ]


@router.get("/interviews/{session_id}", response_model=InterviewSessionOut, dependencies=[Depends(require_admin)])
async def admin_get_interview(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> InterviewSession:
    """Full session + turns — the exact same report shape the student sees on
    /mock-interview/report, read-only for a human admin."""
    session = (
        await db.execute(
            select(InterviewSession)
            .options(selectinload(InterviewSession.turns))
            .where(InterviewSession.id == session_id)
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session


class AdminPracticeSummary(BaseModel):
    id: uuid.UUID
    profile_id: uuid.UUID
    full_name: str | None
    skills_selected: list[str]
    status: str
    overall_score: float | None
    verified_strong_skills: list[str] | None
    verified_weak_skills: list[str] | None
    started_at: datetime
    finished_at: datetime | None


@router.get("/practice", response_model=list[AdminPracticeSummary], dependencies=[Depends(require_admin)])
async def admin_list_practice(
    profile_id: uuid.UUID | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AdminPracticeSummary]:
    limit = min(max(limit, 1), 200)
    query = select(PracticeSession).order_by(PracticeSession.started_at.desc()).limit(limit)
    if profile_id is not None:
        query = query.where(PracticeSession.profile_id == profile_id)
    sessions = (await db.execute(query)).scalars().all()
    if not sessions:
        return []

    profiles = (
        await db.execute(select(StudentProfile).where(StudentProfile.id.in_({s.profile_id for s in sessions})))
    ).scalars().all()
    names = {p.id: p.full_name for p in profiles}

    return [
        AdminPracticeSummary(
            id=s.id,
            profile_id=s.profile_id,
            full_name=names.get(s.profile_id),
            skills_selected=s.skills_selected,
            status=s.status,
            overall_score=s.overall_score,
            verified_strong_skills=s.verified_strong_skills,
            verified_weak_skills=s.verified_weak_skills,
            started_at=s.started_at,
            finished_at=s.finished_at,
        )
        for s in sessions
    ]


class AdminGapSummary(BaseModel):
    id: uuid.UUID
    profile_id: uuid.UUID
    full_name: str | None
    target_role: str
    readiness_score: float | None
    jobs_analyzed: int
    match_ratio: float
    created_at: datetime


@router.get("/gaps", response_model=list[AdminGapSummary], dependencies=[Depends(require_admin)])
async def admin_list_gaps(
    profile_id: uuid.UUID | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AdminGapSummary]:
    limit = min(max(limit, 1), 200)
    query = select(SkillGapSnapshot).order_by(SkillGapSnapshot.created_at.desc()).limit(limit)
    if profile_id is not None:
        query = query.where(SkillGapSnapshot.profile_id == profile_id)
    snapshots = (await db.execute(query)).scalars().all()
    if not snapshots:
        return []

    profiles = (
        await db.execute(select(StudentProfile).where(StudentProfile.id.in_({s.profile_id for s in snapshots})))
    ).scalars().all()
    names = {p.id: p.full_name for p in profiles}

    return [
        AdminGapSummary(
            id=s.id,
            profile_id=s.profile_id,
            full_name=names.get(s.profile_id),
            target_role=s.target_role,
            readiness_score=(s.gap_data or {}).get("readiness_score"),
            jobs_analyzed=s.jobs_analyzed,
            match_ratio=s.match_ratio,
            created_at=s.created_at,
        )
        for s in snapshots
    ]


class AdminRoadmapSummary(BaseModel):
    id: uuid.UUID
    profile_id: uuid.UUID
    full_name: str | None
    total_weeks: int | None
    status: str
    progress_pct: float
    created_at: datetime


@router.get("/roadmaps", response_model=list[AdminRoadmapSummary], dependencies=[Depends(require_admin)])
async def admin_list_roadmaps(
    profile_id: uuid.UUID | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AdminRoadmapSummary]:
    limit = min(max(limit, 1), 200)
    query = select(Roadmap).order_by(Roadmap.created_at.desc()).limit(limit)
    if profile_id is not None:
        query = query.where(Roadmap.profile_id == profile_id)
    roadmaps = (await db.execute(query)).scalars().all()
    if not roadmaps:
        return []

    profiles = (
        await db.execute(select(StudentProfile).where(StudentProfile.id.in_({r.profile_id for r in roadmaps})))
    ).scalars().all()
    names = {p.id: p.full_name for p in profiles}

    return [
        AdminRoadmapSummary(
            id=r.id,
            profile_id=r.profile_id,
            full_name=names.get(r.profile_id),
            total_weeks=r.total_weeks,
            status=r.status,
            progress_pct=compute_roadmap_progress_pct(r),
            created_at=r.created_at,
        )
        for r in roadmaps
    ]


class AdminCurriculumSummary(BaseModel):
    id: uuid.UUID
    profile_id: uuid.UUID
    full_name: str | None
    section_count: int
    module_count: int
    completed_modules: int
    status: str
    created_at: datetime


@router.get("/learning", response_model=list[AdminCurriculumSummary], dependencies=[Depends(require_admin)])
async def admin_list_learning(
    profile_id: uuid.UUID | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AdminCurriculumSummary]:
    limit = min(max(limit, 1), 200)
    query = select(LearningCurriculum).order_by(LearningCurriculum.created_at.desc()).limit(limit)
    if profile_id is not None:
        query = query.where(LearningCurriculum.profile_id == profile_id)
    curricula = (await db.execute(query)).scalars().all()
    if not curricula:
        return []

    profiles = (
        await db.execute(select(StudentProfile).where(StudentProfile.id.in_({c.profile_id for c in curricula})))
    ).scalars().all()
    names = {p.id: p.full_name for p in profiles}

    return [
        AdminCurriculumSummary(
            id=c.id,
            profile_id=c.profile_id,
            full_name=names.get(c.profile_id),
            section_count=len(c.sections or []),
            module_count=sum(len(s.get("modules", [])) for s in (c.sections or [])),
            completed_modules=len((c.progress or {}).get("completed_modules", [])),
            status=c.status,
            created_at=c.created_at,
        )
        for c in curricula
    ]


# ---------------------------------------------------------------------------
# Master roadmap JSON (filesystem templates — not per-student DB rows)
# ---------------------------------------------------------------------------


class MasterRoadmapSummary(BaseModel):
    role_key: str
    role: str
    roadmap_version: str
    phase_count: int
    node_count: int
    source: str


class MasterRoadmapValidateResponse(BaseModel):
    valid: bool
    role_key: str
    phase_count: int
    node_count: int


class MasterRoadmapScaffoldRequest(BaseModel):
    role_key: str
    role: str
    summary: str | None = None


class MasterRoadmapRegistryEntry(BaseModel):
    role_key: str
    role: str
    has_json: bool


@router.get("/master-roadmaps", response_model=list[MasterRoadmapSummary], dependencies=[Depends(require_admin)])
async def admin_list_master_roadmaps() -> list[MasterRoadmapSummary]:
    return [MasterRoadmapSummary(**row) for row in list_available_roadmaps()]


@router.get(
    "/master-roadmaps/registry",
    response_model=list[MasterRoadmapRegistryEntry],
    dependencies=[Depends(require_admin)],
)
async def admin_master_roadmap_registry() -> list[MasterRoadmapRegistryEntry]:
    return [MasterRoadmapRegistryEntry(**row) for row in list_master_roadmap_registry()]


@router.post(
    "/master-roadmaps/scaffold",
    response_model=MasterRoadmapDocument,
    dependencies=[Depends(require_admin)],
)
async def admin_scaffold_master_roadmap(payload: MasterRoadmapScaffoldRequest) -> MasterRoadmapDocument:
    try:
        return scaffold_master_document(payload.role_key, payload.role, payload.summary)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/master-roadmaps/validate",
    response_model=MasterRoadmapValidateResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_validate_master_roadmap(payload: dict) -> MasterRoadmapValidateResponse:
    try:
        doc = validate_master_document(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MasterRoadmapValidateResponse(
        valid=True,
        role_key=doc.role_key,
        phase_count=len(doc.phases),
        node_count=sum(len(p.nodes) for p in doc.phases),
    )


@router.get(
    "/master-roadmaps/{role_key}",
    response_model=MasterRoadmapDocument,
    dependencies=[Depends(require_admin)],
)
async def admin_get_master_roadmap(role_key: str) -> MasterRoadmapDocument:
    try:
        return load_master_document(role_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put(
    "/master-roadmaps/{role_key}",
    response_model=MasterRoadmapDocument,
    dependencies=[Depends(require_admin)],
)
async def admin_put_master_roadmap(role_key: str, payload: dict) -> MasterRoadmapDocument:
    try:
        return save_master_document(role_key, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/master-roadmaps/{role_key}",
    response_model=MasterRoadmapDocument,
    dependencies=[Depends(require_admin)],
)
async def admin_create_master_roadmap(role_key: str, payload: dict) -> MasterRoadmapDocument:
    try:
        return save_master_document(role_key, payload, create_only=True)
    except ValueError as exc:
        status = 409 if "already exists" in str(exc) else 422
        raise HTTPException(status_code=status, detail=str(exc)) from exc
