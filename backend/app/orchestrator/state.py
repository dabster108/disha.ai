from __future__ import annotations

from typing import TypedDict


class CareerState(TypedDict, total=False):
    """State flowing through the intake -> gap -> roadmap graph."""

    student_skills: list[str]
    target_role: str
    location: str | None
    time_per_week: int | None
    budget: str | None

    skill_gap: dict
    roadmap: dict | None
