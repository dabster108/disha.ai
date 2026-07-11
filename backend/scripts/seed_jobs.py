"""Seed data/jobs.json with Nepal-relevant demo postings for local dev / empty corpus.

Usage:
    uv run python -m scripts.seed_jobs
    uv run python -m app.rag.ingest --reset
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scraper.models import JobPosting, JobsFile, utc_now_iso

DATA_DIR = ROOT / "data"
JOBS_PATH = DATA_DIR / "jobs.json"


def _job(
    job_id: str,
    title: str,
    company: str,
    skills: list[str],
    location: str = "Kathmandu",
    salary: str = "Negotiable",
) -> JobPosting:
    slug = job_id.replace("seed-", "")
    return JobPosting(
        id=job_id,
        source="kamkhoj",
        title=title,
        company=company,
        location=location,
        required_skills=skills,
        salary_range=salary,
        source_url=f"https://kamkhoj.com/job/{slug}",
        aggregator="kamkhoj",
        original_source="merojob",
    )


SEED_JOBS: list[JobPosting] = [
    _job("seed-backend-001", "Backend Developer", "F1Soft International", ["Python", "FastAPI", "PostgreSQL", "Docker"]),
    _job("seed-backend-002", "Python Backend Developer", "Verisk Nepal", ["Python", "Django", "REST API", "SQL"]),
    _job("seed-backend-003", "Junior Backend Engineer", "CloudFactory", ["Python", "Node.js", "MongoDB", "Git"]),
    _job("seed-backend-004", "API Developer", "Leapfrog Technology", ["FastAPI", "PostgreSQL", "Redis", "AWS"]),
    _job("seed-backend-005", "Software Engineer (Backend)", "Deerhold Ltd", ["Java", "Spring Boot", "MySQL", "Microservices"]),
    _job("seed-fullstack-001", "Full Stack Developer", "Rigo Technology", ["React", "Node.js", "PostgreSQL", "TypeScript"]),
    _job("seed-frontend-001", "Frontend Developer", "Genese Solution", ["React", "JavaScript", "Tailwind CSS", "REST API"]),
    _job("seed-data-001", "Data Analyst", "Ncell Axiata", ["SQL", "Python", "Power BI", "Excel"]),
    _job("seed-data-002", "Junior Data Scientist", "Fusemachines", ["Python", "Machine Learning", "Pandas", "SQL"]),
    _job("seed-ml-001", "Machine Learning Engineer", "Omnicom Media Group", ["Python", "TensorFlow", "MLOps", "Docker"]),
    _job("seed-devops-001", "DevOps Engineer", "Logpoint Nepal", ["Docker", "Kubernetes", "AWS", "CI/CD"]),
    _job("seed-qa-001", "QA Engineer", "EB Pearls", ["Selenium", "API Testing", "Postman", "Jira"]),
    _job("seed-mobile-001", "Flutter Developer", "Braindigit IT", ["Flutter", "Dart", "Firebase", "REST API"]),
    _job("seed-marketing-001", "Digital Marketing Executive", "SastoDeal", ["SEO", "Google Ads", "Social Media", "Analytics"]),
    _job("seed-sales-001", "Business Development Officer", "Khatabook Nepal", ["Sales", "CRM", "Communication", "Negotiation"]),
    _job("seed-finance-001", "Junior Accountant", "CG Corp Global", ["Tally", "Excel", "VAT", "Bookkeeping"]),
    _job("seed-hr-001", "HR Officer", "Chaudhary Group", ["Recruitment", "HRIS", "Payroll", "Communication"]),
    _job("seed-nurse-001", "Staff Nurse", "Grande International Hospital", ["Patient Care", "ICU", "BNS", "Clinical"]),
    _job("seed-edu-001", "IT Instructor", "Islington College", ["Teaching", "Python", "Networking", "Communication"]),
    _job("seed-backend-006", "Backend Developer (Node.js)", "Prixa Technologies", ["Node.js", "Express", "PostgreSQL", "TypeScript"]),
    _job("seed-backend-007", "Associate Software Engineer", "Yeti Studio", ["Python", "FastAPI", "React", "SQL"]),
    _job("seed-backend-008", "Server-Side Developer", "Javra Software", ["Java", "Kotlin", "PostgreSQL", "Spring"]),
    _job("seed-intern-001", "Software Engineering Intern", "TechLance Nepal", ["Python", "Git", "SQL", "Problem Solving"]),
    _job("seed-php-001", "PHP Developer", "Webtech Nepal", ["PHP", "Laravel", "MySQL", "JavaScript"]),
    _job("seed-remote-001", "Remote Backend Developer", "Global Tech Partners", ["Python", "FastAPI", "AWS", "PostgreSQL"], location="Remote / Kathmandu"),
]


def seed_jobs_file() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    jobs_file = JobsFile(
        scraped_at=utc_now_iso(),
        sources=["kamkhoj"],
        jobs=SEED_JOBS,
    )
    JOBS_PATH.write_text(
        json.dumps(jobs_file.model_dump(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return len(SEED_JOBS)


def it_seed_jobs() -> list[JobPosting]:
    """Curated Nepal IT postings only — used to densify a tech-focus scrape."""
    from scraper.tech_focus import is_it_sector_job

    return [job for job in SEED_JOBS if is_it_sector_job(job)]


def merge_it_seeds_into_jobs_file() -> tuple[int, int]:
    """Append missing IT seed jobs into an existing jobs.json (no overwrite)."""
    if not JOBS_PATH.exists():
        n = seed_jobs_file()
        return n, n

    raw = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    jobs_file = JobsFile.model_validate(raw)
    existing_ids = {job.id for job in jobs_file.jobs}
    existing_titles = {(job.title.casefold(), job.company.casefold()) for job in jobs_file.jobs}
    added = 0
    for seed in it_seed_jobs():
        key = (seed.title.casefold(), seed.company.casefold())
        if seed.id in existing_ids or key in existing_titles:
            continue
        jobs_file.jobs.append(seed)
        existing_ids.add(seed.id)
        existing_titles.add(key)
        added += 1
    jobs_file.scraped_at = utc_now_iso()
    JOBS_PATH.write_text(
        json.dumps(jobs_file.model_dump(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return added, len(jobs_file.jobs)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Seed or densify data/jobs.json")
    parser.add_argument(
        "--merge-it",
        action="store_true",
        help="Append curated IT seed jobs into existing jobs.json (tech-focus densify).",
    )
    args = parser.parse_args()
    if args.merge_it:
        added, total = merge_it_seeds_into_jobs_file()
        print(f"Merged {added} IT seed jobs → {total} total in {JOBS_PATH}")
    else:
        count = seed_jobs_file()
        print(f"Wrote {count} seed jobs to {JOBS_PATH}")
    print("Next: uv run python -m app.rag.ingest --reset")


if __name__ == "__main__":
    main()
