"""IT / software-sector focus for the Nepal job corpus.

DISHA is built around tech career navigation. Generic portal scrapes are
dominated by sales/admin/education postings — this module:

1. Classifies a JobPosting as IT-sector (reuse RAG role categories).
2. Supplies portal-specific search/category entry points so scrapers pull
   tech listings first instead of hoping the homepage feed is technical.
"""

from __future__ import annotations

from scraper.models import JobPosting

# Align with skill_gap._TECH_ROLE_CATEGORIES (+ "software"/"tech" catch-alls).
# Excludes graphic "design" / PM "product" — those aren't software-engineering
# market signal for Backend/Frontend/Data students.
IT_ROLE_CATEGORIES = frozenset({
    "backend",
    "frontend",
    "fullstack",
    "software",
    "tech",
    "ml_ai",
    "data",
    "devops",
    "mobile",
    "qa",
})

# Merojob API honors ``q=`` (other params are ignored). Prefer stack-specific
# queries first — a bare "developer" can fall through to noisy general results.
MEROJOB_TECH_QUERIES = (
    "python",
    "react",
    "java",
    "devops",
    "flutter",
    "Django",
    "Laravel",
    "Node.js",
    "PHP",
    "backend",
    "frontend",
    "full stack",
    "software engineer",
    "QA",
    "data analyst",
    "data engineer",
    "machine learning",
    "cybersecurity",
    "network",
    "IT officer",
    "mobile developer",
    "developer",
)

# KamKhoj category listing pages (SSR + JS pagination same as /jobs).
KAMKHOJ_TECH_PATHS = (
    "/jobs/category/information-technology",
    "/jobs/category/software-development",
)

# Kumarijob keyword search pages (Crawl4AI).
KUMARIJOB_TECH_PAGES = (
    "https://www.kumarijob.com/search?keywords=developer",
    "https://www.kumarijob.com/search?keywords=software",
    "https://www.kumarijob.com/search?keywords=python",
    "https://www.kumarijob.com/search?keywords=IT",
    "https://www.kumarijob.com/search?keywords=react",
)


def is_it_sector_job(job: JobPosting) -> bool:
    """True when title/skills classify as IT / software engineering."""
    # Lazy import: documents depends on scraper.models/normalize, not this module.
    from app.rag.documents import (
        infer_role_category,
        is_technical_role,
        title_is_non_technical,
    )

    if title_is_non_technical(job.title):
        return False
    category = infer_role_category(job.title, job.required_skills or [])
    if category in IT_ROLE_CATEGORIES:
        return True
    # Title says developer/software engineer even if category fell to "general".
    return is_technical_role(job.title)


def filter_it_jobs(jobs: list[JobPosting]) -> list[JobPosting]:
    """Keep IT-sector postings only, preserving order."""
    return [job for job in jobs if is_it_sector_job(job)]


def tech_oversample_limit(max_jobs: int | None, *, multiplier: int = 6) -> int | None:
    """When filtering after a general scrape, fetch more raw listings first."""
    if max_jobs is None:
        return None
    return max(max_jobs * multiplier, max_jobs + 50)
