from __future__ import annotations

import uuid

from app.db.models import StudentProfile
from app.db.session import async_session_factory
from app.orchestrator.state import CareerState


async def intake_node(state: CareerState) -> dict:
    """Load the profile and populate constraints. No LLM."""
    profile_id = state.get("profile_id")
    if not profile_id:
        # Legacy market-only path: caller already supplied student_skills/target_role.
        return {}

    async with async_session_factory() as db:
        profile = await db.get(StudentProfile, uuid.UUID(profile_id))

    if profile is None:
        return {"error": f"Profile {profile_id} not found"}

    return {
        "profile": profile,
        "student_skills": profile.skills or [],
        "target_role": profile.target_role,
        "location": profile.location,
        "time_per_week": profile.time_per_week,
        "budget": profile.budget,
    }
