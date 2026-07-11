from __future__ import annotations

import uuid

from app.db.models import StudentProfile
from app.db.session import async_session_factory
from app.orchestrator.state import CareerState
from app.services.roadmap_personalization import build_user_roadmap_dict


async def roadmap_node(state: CareerState) -> dict:
    if state.get("error"):
        return {}

    profile_id = state.get("profile_id")
    if not profile_id:
        return {"roadmap": None}

    async with async_session_factory() as db:
        profile = await db.get(StudentProfile, uuid.UUID(profile_id))
    if profile is None:
        return {"error": f"Profile {profile_id} not found"}

    gap_data = state.get("skill_gap") or {}
    path_dict, progress, summary = await build_user_roadmap_dict(profile, gap_data)
    return {
        "roadmap": {
            "weeks": [],
            "total_weeks": 0,
            "summary": summary,
            "path": path_dict,
            "progress": progress,
        }
    }
