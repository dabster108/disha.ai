from __future__ import annotations

from app.orchestrator.state import CareerState
from app.services.skill_gap import compute_skill_gap


def gap_node(state: CareerState) -> dict:
    gap = compute_skill_gap(
        state["student_skills"],
        state["target_role"],
    )
    return {"skill_gap": gap}
