"""Debug job matching thresholds for a profile."""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import async_session_factory
from app.rag.retriever import search_jobs
from app.services.job_matching import rank_jobs_for_student, score_job
from app.services.skill_gap import load_gap_context


async def main() -> None:
    profile_id = uuid.UUID(sys.argv[1] if len(sys.argv) > 1 else "ce563586-9122-40ff-b75b-55014f039440")
    async with async_session_factory() as db:
        ctx = await load_gap_context(db, profile_id)
    if ctx is None:
        print("Profile not found")
        return

    print("target_role:", ctx.profile.target_role)
    print("skills:", ctx.profile.skills)
    candidates = search_jobs(ctx.profile.target_role, n=12)
    print("candidates:", len(candidates))
    for c in candidates:
        scored = score_job(c, ctx)
        passed = scored["passes_thresholds"]
        f = scored["factors"]
        title = (c.get("title") or "")[:55]
        print(
            f"  {title:55} comp={scored['composite_score']:.2f} "
            f"role={f['role_similarity']:.2f} "
            f"skills={f['skills_match']:.2f} "
            f"domain={f['domain_match']:.2f} "
            f"seniority={f['seniority_match']:.2f} "
            f"PASS={passed}"
        )

    matches = rank_jobs_for_student(ctx)
    print("final matches:", len(matches))


if __name__ == "__main__":
    asyncio.run(main())
