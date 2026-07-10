"""Deterministic skill-gap computation: student skills vs live job-market demand.

No LLM here — the gap is a set comparison against skills aggregated from
real postings retrieved via RAG. The roadmap step (later) is where Groq
turns the gap into a plan.
"""

from __future__ import annotations

from app.rag.retriever import search_jobs


def compute_skill_gap(
    student_skills: list[str],
    target_role: str,
    *,
    n_jobs: int = 15,
) -> dict:
    jobs = search_jobs(target_role, n=n_jobs)

    # Aggregate market demand per skill (casefolded key, first-seen display form).
    demand: dict[str, dict] = {}
    for job in jobs:
        for skill in job["required_skills"]:
            key = skill.casefold().strip()
            if not key:
                continue
            entry = demand.setdefault(key, {"skill": skill.strip(), "jobs_requiring": 0})
            entry["jobs_requiring"] += 1

    student_keys = {skill.casefold().strip() for skill in student_skills}
    matched = [entry for key, entry in demand.items() if key in student_keys]
    missing = [entry for key, entry in demand.items() if key not in student_keys]
    matched.sort(key=lambda entry: entry["jobs_requiring"], reverse=True)
    missing.sort(key=lambda entry: entry["jobs_requiring"], reverse=True)

    return {
        "target_role": target_role,
        "jobs_analyzed": len(jobs),
        "matched_skills": matched,
        "missing_skills": missing,
        "match_ratio": round(len(matched) / max(len(demand), 1), 2),
        "sample_jobs": [
            {
                "title": job["title"],
                "company": job["company"],
                "location": job["location"],
                "source_url": job["source_url"],
                "similarity": job["similarity"],
            }
            for job in jobs[:5]
        ],
    }
