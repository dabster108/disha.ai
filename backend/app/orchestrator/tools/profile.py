"""LangChain tools over student profile + assessment data.

Each opens its own short-lived DB session (consistent with the orchestrator
nodes) rather than depending on FastAPI's request-scoped session, so these
tools work standalone for any future agent (chatbot, roadmap, etc.).
"""

from __future__ import annotations

import uuid

from langchain_core.tools import tool
from sqlalchemy import select

from app.db.models import InterviewSession, PracticeSession, StudentProfile
from app.db.session import async_session_factory


@tool
async def get_profile_tool(profile_id: str) -> dict:
    """Fetch a student profile: skills, target role, experience, location, constraints."""
    async with async_session_factory() as db:
        profile = await db.get(StudentProfile, uuid.UUID(profile_id))
    if profile is None:
        return {"error": f"Profile {profile_id} not found"}
    return {
        "id": str(profile.id),
        "full_name": profile.full_name,
        "target_role": profile.target_role,
        "skills": profile.skills or [],
        "years_of_experience": profile.years_of_experience,
        "location": profile.location,
        "time_per_week": profile.time_per_week,
        "budget": profile.budget,
    }


@tool
async def get_latest_assessments_tool(profile_id: str) -> dict:
    """Fetch the latest completed interview and practice session summaries for a profile."""
    pid = uuid.UUID(profile_id)
    async with async_session_factory() as db:
        interview = (
            await db.execute(
                select(InterviewSession)
                .where(InterviewSession.profile_id == pid, InterviewSession.status == "completed")
                .order_by(InterviewSession.started_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        practice = (
            await db.execute(
                select(PracticeSession)
                .where(PracticeSession.profile_id == pid, PracticeSession.status == "completed")
                .order_by(PracticeSession.started_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    return {
        "interview": (
            {
                "session_id": str(interview.id),
                "overall_score": interview.overall_score,
                "strengths": interview.strengths or [],
                "weaknesses": interview.weaknesses or [],
                "summary": interview.summary,
            }
            if interview
            else None
        ),
        "practice": (
            {
                "session_id": str(practice.id),
                "overall_score": practice.overall_score,
                "verified_strong_skills": practice.verified_strong_skills or [],
                "verified_weak_skills": practice.verified_weak_skills or [],
                "skill_scores": practice.skill_scores or {},
            }
            if practice
            else None
        ),
    }
