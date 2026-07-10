from __future__ import annotations

import uuid

from app.config import get_settings
from app.db.session import async_session_factory
from app.orchestrator.state import CareerState
from app.services.roadmap import classify_gap_size
from app.services.skill_gap import compute_combined_skill_gap, compute_market_gap, generate_gap_narrative, load_gap_context


async def gap_node(state: CareerState) -> dict:
    if state.get("error"):
        return {}

    profile_id = state.get("profile_id")
    if not profile_id:
        # Legacy market-only path — no interview/practice signal to size a roadmap around.
        gap = compute_market_gap(state["student_skills"], state["target_role"])
        return {"skill_gap": gap, "gap_size": "small"}

    interview_session_id = state.get("interview_session_id")
    practice_session_id = state.get("practice_session_id")
    n_jobs = state.get("n_jobs") or get_settings().gap_n_jobs

    async with async_session_factory() as db:
        ctx = await load_gap_context(
            db,
            uuid.UUID(profile_id),
            interview_session_id=uuid.UUID(interview_session_id) if interview_session_id else None,
            practice_session_id=uuid.UUID(practice_session_id) if practice_session_id else None,
            n_jobs=n_jobs,
        )
        if ctx is None:
            return {"error": f"Profile {profile_id} not found"}

        gap_data = compute_combined_skill_gap(ctx)
        narrative = None
        if state.get("include_narrative", True):
            narrative = await generate_gap_narrative(gap_data, ctx.profile)

    return {
        "skill_gap": gap_data,
        "narrative_summary": narrative,
        "gap_size": classify_gap_size(gap_data),
        "interview_session_id": str(ctx.interview.id) if ctx.interview else None,
        "practice_session_id": str(ctx.practice.id) if ctx.practice else None,
    }
