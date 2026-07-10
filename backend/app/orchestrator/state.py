from __future__ import annotations

from typing import Literal, TypedDict


class CareerState(TypedDict, total=False):
    """State flowing through the intake -> gap -> roadmap -> save graph."""

    # Inputs
    profile_id: str | None
    interview_session_id: str | None
    practice_session_id: str | None
    include_narrative: bool
    run_roadmap: bool
    n_jobs: int | None

    # Legacy market-only path (no profile_id) — pre-existing callers.
    student_skills: list[str]
    target_role: str
    location: str | None
    time_per_week: int | None
    budget: str | None

    # Derived / outputs
    gap_size: Literal["large", "small"]
    skill_gap: dict
    narrative_summary: str | None
    roadmap: dict | None
    snapshot_id: str | None
    roadmap_id: str | None
    error: str | None
