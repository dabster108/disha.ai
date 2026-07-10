from __future__ import annotations

from app.orchestrator.state import CareerState


def roadmap_node(state: CareerState) -> dict:
    # Deliberately unimplemented until step 5/6: Groq will turn the gap into
    # a week-by-week plan constrained by time_per_week and budget.
    return {"roadmap": None}
