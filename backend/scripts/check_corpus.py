"""Validate jobs.json + Chroma corpus after scrape/ingest."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import chromadb
from pydantic import ValidationError

from app.config import get_settings
from app.rag.retriever import search_jobs
from scraper.models import JobsFile


def main() -> None:
    settings = get_settings()
    print("=" * 60)
    print("DISHA Job Corpus Health Check")
    print("=" * 60)

    # --- jobs.json ---
    if not settings.jobs_file.exists():
        print(f"FAIL: {settings.jobs_file} missing — run scraper first")
        sys.exit(1)

    raw = json.loads(settings.jobs_file.read_text(encoding="utf-8"))
    try:
        jobs_file = JobsFile.model_validate(raw)
    except ValidationError as exc:
        print("FAIL: jobs.json schema invalid")
        print(exc)
        sys.exit(1)

    jobs = jobs_file.jobs
    print(f"\njobs.json: OK ({len(jobs)} jobs)")
    print(f"  scraped_at: {jobs_file.scraped_at}")
    print(f"  sources:    {jobs_file.sources}")

    by_source = Counter(j.source for j in jobs)
    print("  per source:", dict(by_source))

    with_skills = sum(1 for j in jobs if j.required_skills)
    with_salary = sum(1 for j in jobs if j.salary_range not in ("", "Not disclosed"))
    print(f"  with skills: {with_skills}/{len(jobs)} ({100*with_skills//max(len(jobs),1)}%)")
    print(f"  with salary: {with_salary}/{len(jobs)} ({100*with_salary//max(len(jobs),1)}%)")

    # Sample record
    sample = jobs[0]
    print("\nSample job record:")
    print(json.dumps(sample.model_dump(), indent=2)[:600], "...")

    tech_keywords = ("developer", "engineer", "backend", "frontend", "python", "software", "data", "devops")
    tech_jobs = [j for j in jobs if any(k in j.title.lower() for k in tech_keywords)]
    print(f"\nTech-ish titles: {len(tech_jobs)}")
    for j in tech_jobs[:8]:
        print(f"  - {j.title} @ {j.company} ({j.source})")

    # --- Chroma ---
    client = chromadb.PersistentClient(path=str(settings.chroma_path))
    try:
        collection = client.get_collection(settings.chroma_collection)
        chroma_count = collection.count()
    except Exception as exc:
        print(f"\nFAIL: Chroma collection error: {exc}")
        sys.exit(1)

    print(f"\nChroma '{settings.chroma_collection}': {chroma_count} vectors")
    if chroma_count != len(jobs):
        print(f"  WARN: count mismatch (json={len(jobs)}, chroma={chroma_count})")
    else:
        print("  OK: counts match jobs.json")

    peek = collection.peek(limit=1)
    if peek["ids"]:
        print(f"  sample id: {peek['ids'][0]}")
        doc = (peek.get("documents") or [""])[0]
        print(f"  sample doc preview: {doc[:200]}...")

    # --- Retrieval smoke test ---
    for query in ("Backend Developer", "Data Analyst", "Marketing"):
        results = search_jobs(query, n=5, min_similarity=0.35)
        print(f"\nRetrieval '{query}': {len(results)} hits")
        for r in results[:3]:
            print(f"  - {r.get('title')} (sim={r.get('similarity', 0):.2f})")

    print("\n" + "=" * 60)
    print("Corpus ready for /api/jobs/match")
    print("=" * 60)


if __name__ == "__main__":
    main()
