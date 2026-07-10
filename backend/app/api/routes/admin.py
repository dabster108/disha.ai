"""Admin endpoints: trigger scrape runs and inspect their history.

Protected by the X-Admin-Key header (ADMIN_API_KEY in .env). The scrape runs
as an in-process background task — one at a time — and optionally re-ingests
Chroma when it finishes.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import get_settings
from app.db.models import ScrapeRun
from app.db.session import async_session_factory
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
    mode: Literal["aggregator", "direct", "hybrid"] = "aggregator"
    sources: list[str] | None = Field(None, description="Override mode with explicit sources")
    max_per_source: int | None = Field(100, ge=1, le=2000)
    reingest_chroma: bool = True


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


@router.post("/scrape", status_code=202, dependencies=[Depends(require_admin)])
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


@router.get("/scrape/sources/ranking", dependencies=[Depends(require_admin)])
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
