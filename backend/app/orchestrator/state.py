from __future__ import annotations

from typing import TypedDict


class CareerState(TypedDict, total=False):
    """State flowing through the intake -> gap -> roadmap graph."""

    student_skills: list[str]
    target_role: str
    location: str | None
    time_per_week: int | None
    budget: str | None

    # When profile_id is set, gap_node runs the full 4-signal combined gap
    # (profile + market + interview + practice) instead of market-only.
    profile_id: str | None
    interview_session_id: str | None
    practice_session_id: str | None

    skill_gap: dict
    roadmap: dict | None
