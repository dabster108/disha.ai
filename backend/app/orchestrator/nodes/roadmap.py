from __future__ import annotations

import asyncio
import uuid

from app.db.models import StudentProfile
from app.db.session import async_session_factory
from app.orchestrator.state import CareerState
from app.services.roadmap_personalization import build_user_roadmap_dict
from app.services.skill_gap import generate_gap_narrative


async def roadmap_node(state: CareerState) -> dict:
    if state.get("error"):
        return {}

    profile_id = state.get("profile_id")
    if not profile_id:
        return {"roadmap": None}

    # gap_node already loaded this profile (and, when roadmap will run,
    # deliberately skipped generating the narrative so it could be gathered
    # alongside the roadmap build here instead of run serially before it).
    profile = state.get("profile")
    if profile is None:
        async with async_session_factory() as db:
            profile = await db.get(StudentProfile, uuid.UUID(profile_id))
        if profile is None:
            return {"error": f"Profile {profile_id} not found"}

    gap_data = state.get("skill_gap") or {}

    if state.get("include_narrative", True):
        narrative, (path_dict, progress, summary) = await asyncio.gather(
            generate_gap_narrative(gap_data, profile),
            build_user_roadmap_dict(profile, gap_data),
        )
    else:
        narrative = None
        path_dict, progress, summary = await build_user_roadmap_dict(profile, gap_data)

    return {
        "narrative_summary": narrative,
        "roadmap": {
            "weeks": [],
            "total_weeks": 0,
            "summary": summary,
            "path": path_dict,
            "progress": progress,
        },
    }
