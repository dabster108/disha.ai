from __future__ import annotations

import uuid

from app.db.session import async_session_factory
from app.orchestrator.state import CareerState
from app.services.skill_gap import compute_combined_skill_gap, compute_market_gap, load_gap_context


async def gap_node(state: CareerState) -> dict:
    profile_id = state.get("profile_id")
    if not profile_id:
        # No profile to load interview/practice signals for — market-only gap.
        gap = compute_market_gap(state["student_skills"], state["target_role"])
        return {"skill_gap": gap}

    interview_session_id = state.get("interview_session_id")
    practice_session_id = state.get("practice_session_id")

    async with async_session_factory() as db:
        ctx = await load_gap_context(
            db,
            uuid.UUID(profile_id),
            interview_session_id=uuid.UUID(interview_session_id) if interview_session_id else None,
            practice_session_id=uuid.UUID(practice_session_id) if practice_session_id else None,
        )
        if ctx is None:
            raise ValueError(f"Profile {profile_id} not found")
        gap = compute_combined_skill_gap(ctx)

    return {"skill_gap": gap}
