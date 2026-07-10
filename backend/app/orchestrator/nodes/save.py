from __future__ import annotations

import uuid

from app.db.models import Roadmap, SkillGapSnapshot
from app.db.session import async_session_factory
from app.orchestrator.state import CareerState


async def save_node(state: CareerState) -> dict:
    """Persist skill_gap_snapshots (+ roadmaps if a plan was generated). No LLM."""
    if state.get("error"):
        return {}

    profile_id = state.get("profile_id")
    if not profile_id:
        # Legacy market-only path — nothing to persist.
        return {}

    gap_data = state.get("skill_gap") or {}

    async with async_session_factory() as db:
        snapshot = SkillGapSnapshot(
            profile_id=uuid.UUID(profile_id),
            target_role=state.get("target_role") or gap_data.get("target_role", ""),
            interview_session_id=uuid.UUID(state["interview_session_id"]) if state.get("interview_session_id") else None,
            practice_session_id=uuid.UUID(state["practice_session_id"]) if state.get("practice_session_id") else None,
            jobs_analyzed=gap_data.get("jobs_analyzed", 0),
            match_ratio=gap_data.get("match_ratio", 0.0),
            gap_data=gap_data,
            narrative_summary=state.get("narrative_summary"),
        )
        db.add(snapshot)
        await db.flush()  # assign snapshot.id before the roadmap FK needs it

        roadmap_row: Roadmap | None = None
        plan = state.get("roadmap")
        if plan:
            roadmap_row = Roadmap(
                profile_id=uuid.UUID(profile_id),
                snapshot_id=snapshot.id,
                skill_gap=gap_data,
                weeks=plan.get("weeks", []),
                total_weeks=plan.get("total_weeks"),
                summary=plan.get("summary"),
                status="active",
            )
            db.add(roadmap_row)

        await db.commit()
        snapshot_id = snapshot.id
        roadmap_id = roadmap_row.id if roadmap_row else None

    return {
        "snapshot_id": str(snapshot_id),
        "roadmap_id": str(roadmap_id) if roadmap_id else None,
    }
