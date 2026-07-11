"""Thin CLI over scraper/scraper.py, plus the reusable scrape pipeline.

Usage:
    CRAWL4AI_BASE_DIRECTORY=./.crawl4ai uv run python -m scraper.run --mode aggregator --max-per-source 50
    uv run python -m scraper.run --mode direct --max-per-source 50
    uv run python -m scraper.run --source merojob --max-per-source 100

`execute_scrape_run` is also called by POST /api/admin/scrape.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
import uuid as uuid_mod
from datetime import datetime, timezone
from pathlib import Path

from scraper.logging_config import log_event, setup_logging
from scraper.models import JobPosting, JobsFile, utc_now_iso
from scraper.scraper import MODES, SOURCES, dedupe_jobs, scrape_source

DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "jobs.json"


def write_jobs_file(jobs_file: JobsFile, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(jobs_file.model_dump(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def source_stats(jobs: list[JobPosting]) -> list[dict]:
    """Per-source data completeness, sorted best-first — used to rank portals."""
    by_source: dict[str, list[JobPosting]] = {}
    for job in jobs:
        by_source.setdefault(job.source, []).append(job)

    stats = []
    for source, source_jobs in by_source.items():
        total = len(source_jobs)
        skills_pct = 100 * sum(1 for j in source_jobs if j.required_skills) / total
        salary_pct = 100 * sum(1 for j in source_jobs if j.salary_range not in ("", "Not disclosed")) / total
        location_pct = 100 * sum(1 for j in source_jobs if j.location not in ("", "Nepal")) / total
        stats.append(
            {
                "source": source,
                "jobs": total,
                "skills_pct": round(skills_pct),
                "salary_pct": round(salary_pct),
                "location_pct": round(location_pct),
                "completeness": round((skills_pct + salary_pct + location_pct) / 3),
            }
        )
    stats.sort(key=lambda row: row["completeness"], reverse=True)
    return stats


def print_stats(stats: list[dict]) -> None:
    print(f"\n{'Source':<14}{'Jobs':>6}{'Skills %':>10}{'Salary %':>10}{'Location %':>12}")
    for row in stats:
        print(
            f"{row['source']:<14}{row['jobs']:>6}{row['skills_pct']:>10}"
            f"{row['salary_pct']:>10}{row['location_pct']:>12}"
        )


async def execute_scrape_run(
    *,
    mode: str = "aggregator",
    sources: list[str] | None = None,
    max_per_source: int | None = 50,
    output: Path = DEFAULT_OUTPUT,
    log_db: bool = False,
    log_file: bool = False,
    triggered_by: str = "cli",
    run_id: uuid_mod.UUID | None = None,
    tech_focus: bool = False,
) -> dict:
    """Scrape -> dedup -> write jobs.json -> stats. Returns a run summary dict.

    `sources` overrides `mode` when given. With `run_id`, updates that existing
    scrape_runs row (API flow) instead of inserting a new one.
    ``tech_focus`` pulls IT category/search feeds and drops non-tech postings.
    """
    log_path = setup_logging(to_file=log_file)
    requested = sources or MODES[mode]
    started_at = datetime.now(timezone.utc)
    t0 = time.monotonic()

    log_event(
        "RUN_START",
        f"RUN_START mode={mode} sources={requested} tech_focus={tech_focus}",
        mode=mode,
        sources=requested,
        tech_focus=tech_focus,
    )

    jobs: list[JobPosting] = []
    succeeded: list[str] = []
    failed: dict[str, str] = {}
    jobs_by_source: dict[str, int] = {}

    for name in requested:
        log_event("SOURCE_START", f"SOURCE_START source={name}", source=name)
        s0 = time.monotonic()
        try:
            source_jobs = await scrape_source(
                name, max_jobs=max_per_source, tech_focus=tech_focus
            )
        except Exception as exc:
            failed[name] = f"{type(exc).__name__}: {exc}"
            log_event("SOURCE_FAILED", f"SOURCE_FAILED source={name} error={failed[name]}", source=name, error=failed[name])
            continue
        duration = round(time.monotonic() - s0, 1)
        total = len(source_jobs)
        skills_pct = round(100 * sum(1 for j in source_jobs if j.required_skills) / total) if total else 0
        salary_pct = round(100 * sum(1 for j in source_jobs if j.salary_range not in ("", "Not disclosed")) / total) if total else 0
        jobs.extend(source_jobs)
        succeeded.append(name)
        jobs_by_source[name] = total
        log_event(
            "SOURCE_DONE",
            f"SOURCE_DONE source={name} jobs={total} skills_pct={skills_pct} salary_pct={salary_pct} duration_s={duration}",
            source=name, jobs=total, skills_pct=skills_pct, salary_pct=salary_pct, duration_s=duration,
        )

    kept, removed = dedupe_jobs(jobs)
    # Final safety net — adapters already filter, but cross-source merge can
    # still carry a few non-tech cards from homepage fallbacks.
    if tech_focus:
        before_tech = len(kept)
        from scraper.tech_focus import filter_it_jobs

        kept = filter_it_jobs(kept)
        removed += before_tech - len(kept)
        jobs_by_source = {}
        for job in kept:
            jobs_by_source[job.source] = jobs_by_source.get(job.source, 0) + 1
        log_event(
            "TECH_FILTER",
            f"TECH_FILTER kept={len(kept)} dropped={before_tech - len(kept)}",
            kept=len(kept),
            dropped=before_tech - len(kept),
        )

    log_event("DEDUP", f"DEDUP removed={removed} kept={len(kept)}", removed=removed, kept=len(kept))

    jobs_file = JobsFile(
        scraped_at=utc_now_iso(),
        sources=[source for source in SOURCES if source in succeeded],
        jobs=kept,
    )
    write_jobs_file(jobs_file, output)

    stats = source_stats(kept)
    duration_s = round(time.monotonic() - t0, 1)
    if not succeeded:
        status = "failed"
    elif failed:
        status = "partial"
    else:
        status = "completed"
    log_event(
        "RUN_DONE",
        f"RUN_DONE total={len(kept)} duration_s={duration_s} status={status}",
        total=len(kept), duration_s=duration_s, status=status,
    )

    summary = {
        "scrape_mode": mode if sources is None else ("custom-tech" if tech_focus else "custom"),
        "sources_requested": requested,
        "sources_succeeded": succeeded,
        "sources_failed": failed,
        "jobs_count": len(kept),
        "jobs_by_source": jobs_by_source,
        "completeness_by_source": stats,
        "dedup_removed": removed,
        "status": status,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc),
        "duration_seconds": duration_s,
        "triggered_by": triggered_by,
        "log_file": log_path,
        "error_summary": "; ".join(f"{k}: {v}" for k, v in failed.items()) or None,
        "output": str(output),
        "tech_focus": tech_focus,
    }

    if log_db or run_id is not None:
        try:
            await record_run_db(summary, run_id=run_id)
            log_event("DB_LOGGED", "Logged run to scrape_runs")
        except Exception as exc:
            log_event("DB_LOG_FAILED", f"Could not log to Postgres: {type(exc).__name__}: {exc}")

    return summary


async def record_run_db(summary: dict, *, run_id: uuid_mod.UUID | None = None):
    # Imported lazily so the scraper stays usable without the app/DB stack.
    from app.db.models import ScrapeRun
    from app.db.session import async_session_factory

    async with async_session_factory() as session:
        if run_id is not None:
            run = await session.get(ScrapeRun, run_id)
            if run is None:
                raise ValueError(f"scrape_runs row {run_id} not found")
        else:
            run = ScrapeRun()
            session.add(run)

        run.sources = summary["sources_succeeded"]
        run.jobs_count = summary["jobs_count"]
        run.status = summary["status"]
        run.detail = json.dumps(summary["completeness_by_source"])
        run.started_at = summary["started_at"]
        run.finished_at = summary["finished_at"]
        run.duration_seconds = summary["duration_seconds"]
        run.sources_requested = summary["sources_requested"]
        run.sources_succeeded = summary["sources_succeeded"]
        run.sources_failed = summary["sources_failed"]
        run.jobs_by_source = summary["jobs_by_source"]
        run.completeness_by_source = summary["completeness_by_source"]
        run.dedup_removed = summary["dedup_removed"]
        run.scrape_mode = summary["scrape_mode"]
        run.triggered_by = summary["triggered_by"]
        run.log_file = summary["log_file"]
        run.error_summary = summary["error_summary"]
        await session.commit()
        return run.id


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Nepal job portals into data/jobs.json")
    parser.add_argument(
        "--mode",
        choices=list(MODES),
        default="aggregator",
        help="aggregator = kamkhoj only (default); direct = 6 portal scrapers; "
        "hybrid = kamkhoj + merojob/kumarijob enrichment (deduped).",
    )
    parser.add_argument(
        "--max-per-source",
        type=int,
        default=50,
        help="Maximum jobs to collect from each source (default: 50). Use 0 for no limit.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON path (default: backend/data/jobs.json)",
    )
    parser.add_argument(
        "--source",
        action="append",
        choices=list(SOURCES),
        help="Scrape only these sources (overrides --mode).",
    )
    parser.add_argument(
        "--tech-focus",
        action="store_true",
        help="Prefer IT/software category+search feeds and keep only tech-sector jobs.",
    )
    parser.add_argument(
        "--log-db",
        action="store_true",
        help="Record this run in the Postgres scrape_runs table.",
    )
    parser.add_argument(
        "--log-file",
        action="store_true",
        help="Also write data/logs/scrape-{timestamp}.log and .jsonl",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    max_per_source = None if args.max_per_source == 0 else args.max_per_source

    summary = asyncio.run(
        execute_scrape_run(
            mode=args.mode,
            sources=args.source,
            max_per_source=max_per_source,
            output=args.output,
            log_db=args.log_db,
            log_file=args.log_file,
            triggered_by="cli",
            tech_focus=args.tech_focus,
        )
    )

    print(f"\nWrote {summary['jobs_count']} jobs to {summary['output']} (status: {summary['status']})")
    if summary.get("tech_focus"):
        print("Tech-focus: ON (IT / software sector only)")
    print_stats(summary["completeness_by_source"])


if __name__ == "__main__":
    main()
