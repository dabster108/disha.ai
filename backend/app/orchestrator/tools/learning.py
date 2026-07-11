"""LangChain tools for the learning-curriculum agent (app.services.learning_agent).

Each tool wraps one existing implementation — never a second copy of the same
lookup — so the curriculum agent (or any future agent) reads the same ground
truth as the rest of the app.

Lesson prose (explanation/steps/examples/mini-checks) is written by the LLM.
Real, in-app-consumable resources are attached via ``get_learning_resources_tool``
/ ``async_build_resources_for_skill`` — curated catalog videos, plus MCP
(Context7 docs, DuckDuckGo-searched videos) when enabled — never LLM-invented
URLs and never a link that redirects the student out of the app.
"""

from __future__ import annotations

import uuid

from langchain_core.tools import tool
from sqlalchemy import select

from app.db.models import Roadmap, SkillGapSnapshot, StudentProfile
from app.db.session import async_session_factory
from app.services.learning_resources import async_build_resources_for_skill
from app.services.skills_catalog import normalize_skill, skills_for_role


@tool
async def get_profile_context_tool(profile_id: str) -> dict:
    """Fetch the student's profile: skills, target role, experience, location, time/budget constraints."""
    async with async_session_factory() as db:
        profile = await db.get(StudentProfile, uuid.UUID(profile_id))
    if profile is None:
        return {"error": f"Profile {profile_id} not found"}
    return {
        "target_role": profile.target_role,
        "skills": profile.skills or [],
        "years_of_experience": profile.years_of_experience,
        "location": profile.location,
        "time_per_week": profile.time_per_week,
        "budget": profile.budget,
    }


@tool
async def get_priority_skills_tool(profile_id: str) -> list[dict]:
    """Fetch the student's latest skill-gap priority-to-learn list (skill, priority_score, reason)."""
    async with async_session_factory() as db:
        snapshot = (
            await db.execute(
                select(SkillGapSnapshot)
                .where(SkillGapSnapshot.profile_id == uuid.UUID(profile_id))
                .order_by(SkillGapSnapshot.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
    if snapshot is None or not snapshot.gap_data:
        return []
    return snapshot.gap_data.get("priority_learn", [])


@tool
def get_skills_for_role_tool(target_role: str) -> list[str]:
    """Canonical catalog skills expected for a target role (e.g. "Backend Developer")."""
    return skills_for_role(target_role)


@tool
async def get_roadmap_skeleton_tool(profile_id: str) -> dict:
    """Fetch the student's active roadmap skeleton (phase/week titles + target skills only,
    no resources) — for the curriculum to complement rather than duplicate."""
    async with async_session_factory() as db:
        roadmap = (
            await db.execute(
                select(Roadmap)
                .where(Roadmap.profile_id == uuid.UUID(profile_id), Roadmap.status == "active")
                .order_by(Roadmap.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
    if roadmap is None:
        return {"phases": []}
    if roadmap.path and roadmap.path.get("phases"):
        return {
            "phases": [
                {"title": phase.get("title"), "skills": [n.get("skill") for n in phase.get("nodes", [])]}
                for phase in roadmap.path["phases"]
            ]
        }
    return {
        "phases": [
            {"title": week.get("theme"), "skills": [t.get("skill") for t in week.get("tasks", [])]}
            for week in roadmap.weeks or []
        ]
    }


@tool
def normalize_skill_tool(skill: str) -> str | None:
    """Resolve a free-text skill name to its canonical catalog name, or null if unrecognized."""
    return normalize_skill(skill)


@tool
async def get_learning_resources_tool(skill: str, budget: str = "free", limit: int = 3) -> list[dict]:
    """Fetch real, in-app-consumable learning resources (YouTube embeds,
    Context7 docs) for a skill, filtered by budget.

    Curated catalog videos come first, then (if MCP is enabled) Context7
    docs and web-searched YouTube videos. Never invents URLs, and never
    returns a resource the Learning panel can't open in-app.
    """
    return await async_build_resources_for_skill(skill, budget=budget, limit=limit)


LEARNING_TOOLS = [
    get_profile_context_tool,
    get_priority_skills_tool,
    get_skills_for_role_tool,
    get_roadmap_skeleton_tool,
    normalize_skill_tool,
    get_learning_resources_tool,
]
