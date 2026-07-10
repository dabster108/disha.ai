"""Thin CLI over scraper/scraper.py.

Usage:
    CRAWL4AI_BASE_DIRECTORY=./.crawl4ai python -m scraper.run --max-per-source 30
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from scraper.models import JobPosting, JobsFile, utc_now_iso
from scraper.scraper import SOURCES, scrape_all

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


async def log_scrape_run(jobs_file: JobsFile, stats: list[dict]) -> None:
    # Imported lazily so the scraper stays usable without the app/DB stack.
    from app.db.models import ScrapeRun
    from app.db.session import async_session_factory

    async with async_session_factory() as session:
        session.add(
            ScrapeRun(
                sources=list(jobs_file.sources),
                jobs_count=len(jobs_file.jobs),
                status="completed",
                detail=json.dumps(stats),
            )
        )
        await session.commit()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Nepal job portals into data/jobs.json")
    parser.add_argument(
        "--max-per-source",
        type=int,
        default=30,
        help="Maximum jobs to collect from each source (default: 30). Use 0 for no limit.",
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
        help="Limit scraping to one or more sources. Default: all sources.",
    )
    parser.add_argument(
        "--log-db",
        action="store_true",
        help="Record this run in the Postgres scrape_runs table.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    max_per_source = None if args.max_per_source == 0 else args.max_per_source
    sources = args.source or list(SOURCES)

    jobs = asyncio.run(scrape_all(max_per_source=max_per_source, sources=sources))
    jobs_file = JobsFile(
        scraped_at=utc_now_iso(),
        sources=[source for source in SOURCES if source in sources],
        jobs=jobs,
    )
    write_jobs_file(jobs_file, args.output)

    print(f"\nWrote {len(jobs_file.jobs)} jobs to {args.output}")
    stats = source_stats(jobs_file.jobs)
    print_stats(stats)

    if args.log_db:
        try:
            asyncio.run(log_scrape_run(jobs_file, stats))
            print("\nLogged run to scrape_runs.")
        except Exception as exc:
            print(f"\n! Could not log to Postgres: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
