from __future__ import annotations

from typing import Literal, TypedDict

from app.db.models import StudentProfile


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
    # Loaded once in intake, reused by gap/roadmap instead of each re-fetching
    # the same row (expire_on_commit=False on async_session_factory makes the
    # detached ORM object safe to read across node/session boundaries as long
    # as only already-loaded plain columns are touched, which is all gap/
    # roadmap need — see app/db/session.py).
    profile: StudentProfile | None
    gap_size: Literal["large", "small"]
    skill_gap: dict
    narrative_summary: str | None
    roadmap: dict | None
    snapshot_id: str | None
    roadmap_id: str | None
    error: str | None
