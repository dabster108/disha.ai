"""Roadmap generation from a skill gap snapshot.

POST /api/roadmap reuses an existing snapshot when given (or the profile's
latest one matching its current target_role), computing a fresh snapshot
only if none exists yet or the student has since switched goals — this avoids
re-running the Chroma market query and Groq narrative when the caller just
wants a plan from data that's already been assessed.
"""

from __future__ import annotations

import asyncio
import copy
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models import Roadmap, SkillGapSnapshot, StudentProfile
from app.services.learning_resources import attach_resources_to_path, attach_resources_to_weeks
from app.services.roadmap import classify_gap_size, generate_roadmap, generate_skill_path, seed_path_progress
from app.services.skill_gap import get_or_create_current_snapshot

router = APIRouter(prefix="/api", tags=["roadmap"])


class RoadmapRequest(BaseModel):
    profile_id: uuid.UUID
    snapshot_id: uuid.UUID | None = None
    force_replan: bool = False


class RoadmapProgressRequest(BaseModel):
    # Skill-path node toggle (new).
    node_id: str | None = None
    # Legacy week/task toggle — still accepted for roadmaps without a path.
    week: int | None = None
    task_index: int | None = None
    resource_index: int | None = None
    completed: bool = True


class RoadmapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    snapshot_id: uuid.UUID | None
    skill_gap: dict
    weeks: list
    total_weeks: int | None
    summary: str | None
    path: dict | None = None
    progress: dict
    status: str
    created_at: datetime


def _task_resource_count(weeks: list, week: int, task_index: int) -> int:
    for w in weeks or []:
        if w.get("week") == week:
            tasks = w.get("tasks") or []
            if 0 <= task_index < len(tasks):
                return len(tasks[task_index].get("resources") or [])
    return 0


def _annotate_node_status(path: dict | None, progress: dict) -> dict | None:
    """Soft-progression view: first incomplete node is 'active' (the
    recommended next step), everything after is 'upcoming', still clickable."""
    if not path:
        return path
    completed_nodes = set((progress or {}).get("completed_nodes") or [])
    next_is_active = True
    phases = []
    for phase in path.get("phases") or []:
        nodes = []
        for node in phase.get("nodes") or []:
            node = dict(node)
            if node.get("id") in completed_nodes:
                node["status"] = "completed"
            elif next_is_active:
                node["status"] = "active"
                next_is_active = False
            else:
                node["status"] = "upcoming"
            nodes.append(node)
        phases.append({**phase, "nodes": nodes})
    return {**path, "phases": phases}


def _roadmap_out(roadmap: Roadmap) -> RoadmapOut:
    out = RoadmapOut.model_validate(roadmap)
    return out.model_copy(update={"path": _annotate_node_status(roadmap.path, roadmap.progress)})


@router.post("/roadmap", response_model=RoadmapOut, status_code=201)
async def create_roadmap(payload: RoadmapRequest, db: AsyncSession = Depends(get_db)) -> Roadmap:
    profile = await db.get(StudentProfile, payload.profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    if payload.snapshot_id is not None:
        snapshot = await db.get(SkillGapSnapshot, payload.snapshot_id)
        if snapshot is None or snapshot.profile_id != profile.id:
            raise HTTPException(status_code=404, detail="Skill gap snapshot not found for this profile")
    else:
        snapshot = await get_or_create_current_snapshot(db, profile)

    gap_data = snapshot.gap_data
    gap_size = classify_gap_size(gap_data)
    plan, path_plan = await asyncio.gather(
        generate_roadmap(gap_data, profile, gap_size),
        generate_skill_path(gap_data, profile, gap_size),
    )
    path_dict = path_plan.model_dump()
    progress = seed_path_progress(profile, gap_data, path_plan)

    existing = await db.execute(
        select(Roadmap)
        .where(Roadmap.profile_id == profile.id, Roadmap.status == "active")
        .order_by(Roadmap.created_at.desc())
        .limit(1)
    )
    active = existing.scalar_one_or_none()
    if active is not None:
        if payload.force_replan:
            # Keep manually-completed nodes (not auto-seeded) whose id still
            # exists in the regenerated path — everything else is re-seeded fresh.
            old_progress = active.progress or {}
            auto_ids = {e.get("node_id") for e in old_progress.get("auto_completed") or []}
            manually_completed = set(old_progress.get("completed_nodes") or []) - auto_ids
            new_node_ids = {node["id"] for phase in path_dict.get("phases") or [] for node in phase.get("nodes") or []}
            progress["completed_nodes"] = list(set(progress["completed_nodes"]) | (manually_completed & new_node_ids))
        active.status = "replanned"

    roadmap = Roadmap(
        profile_id=profile.id,
        snapshot_id=snapshot.id,
        skill_gap=gap_data,
        weeks=[week.model_dump() for week in plan.weeks],
        total_weeks=plan.total_weeks,
        summary=plan.summary,
        path=path_dict,
        progress=progress,
        status="active",
    )
    db.add(roadmap)
    await db.commit()
    return _roadmap_out(roadmap)


@router.get("/roadmap/{profile_id}", response_model=RoadmapOut)
async def latest_roadmap(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Roadmap:
    # FOR UPDATE: the backfill below can be slow (MCP round trips per skill)
    # and reads-then-writes the whole weeks/path column. Without a row lock,
    # two concurrent GETs for the same roadmap (a real scenario — the
    # frontend polls this endpoint) can both read the stale pre-migration
    # data, and whichever commits last silently reverts the other's freshly
    # regenerated resources back to the old external-only ones. Cheap once
    # migrated, since a fully up-to-date roadmap has nothing left to backfill
    # and returns almost immediately.
    result = await db.execute(
        select(Roadmap)
        .where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
        .order_by(Roadmap.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    roadmap = result.scalar_one_or_none()
    if roadmap is None:
        raise HTTPException(status_code=404, detail="No roadmap yet — POST /api/roadmap first.")

    # Backfill real learning links onto roadmaps generated before resources
    # existed, so the UI always has clickable cards. Persist once.
    profile = await db.get(StudentProfile, profile_id)
    budget = profile.budget if profile else "free"
    # Deep copies, not shallow — attach_resources_to_weeks/_to_path mutate
    # nested task/node dicts in place. A shallow copy shares those nested
    # dicts with the ORM's tracked "before" value, so the mutation silently
    # changes both sides and SQLAlchemy's history sees no net change and
    # skips writing the column entirely (the backfill computes correctly
    # but the UPDATE never happens).
    weeks = copy.deepcopy(roadmap.weeks) if roadmap.weeks else []
    weeks_changed = await attach_resources_to_weeks(weeks, budget=budget)
    path = copy.deepcopy(roadmap.path) if roadmap.path else None
    path_changed = await attach_resources_to_path(path, budget=budget)
    if weeks_changed or path_changed:
        if weeks_changed:
            roadmap.weeks = weeks
        if path_changed:
            roadmap.path = path
        await db.commit()
        await db.refresh(roadmap)
    return _roadmap_out(roadmap)


@router.patch("/roadmap/{profile_id}/progress", response_model=RoadmapOut)
async def update_roadmap_progress(
    profile_id: uuid.UUID, payload: RoadmapProgressRequest, db: AsyncSession = Depends(get_db)
) -> Roadmap:
    result = await db.execute(
        select(Roadmap)
        .where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
        .order_by(Roadmap.created_at.desc())
        .limit(1)
    )
    roadmap = result.scalar_one_or_none()
    if roadmap is None:
        raise HTTPException(status_code=404, detail="No active roadmap for this profile")

    progress = dict(roadmap.progress or {})

    if payload.node_id is not None:
        # Skill-path node toggle — soft progression, manually toggleable either way.
        completed_nodes = list(progress.get("completed_nodes", []))
        exists = payload.node_id in completed_nodes
        if payload.completed and not exists:
            completed_nodes = [*completed_nodes, payload.node_id]
        elif not payload.completed and exists:
            completed_nodes = [n for n in completed_nodes if n != payload.node_id]
        roadmap.progress = {**progress, "completed_nodes": completed_nodes}
        await db.commit()
        return _roadmap_out(roadmap)

    if payload.week is None or payload.task_index is None:
        raise HTTPException(status_code=422, detail="Provide either node_id, or both week and task_index")

    completed = list(progress.get("completed", []))
    resources_done = list(progress.get("resources_completed", []))

    task_entry = {"week": payload.week, "task_index": payload.task_index}

    def _set(items: list[dict], entry: dict, on: bool) -> list[dict]:
        exists = any(e == entry for e in items)
        if on and not exists:
            items = [*items, entry]
        elif not on and exists:
            items = [e for e in items if e != entry]
        return items

    if payload.resource_index is None:
        # Task-level toggle (task with no resources, or "mark whole task done").
        completed = _set(completed, task_entry, payload.completed)
    else:
        # Resource-level toggle — then derive task completion from its resources.
        res_entry = {**task_entry, "resource_index": payload.resource_index}
        resources_done = _set(resources_done, res_entry, payload.completed)

        total_resources = _task_resource_count(roadmap.weeks, payload.week, payload.task_index)
        done_for_task = sum(
            1
            for e in resources_done
            if e.get("week") == payload.week and e.get("task_index") == payload.task_index
        )
        task_complete = total_resources > 0 and done_for_task >= total_resources
        completed = _set(completed, task_entry, task_complete)

    roadmap.progress = {**progress, "completed": completed, "resources_completed": resources_done}
    await db.commit()
    return _roadmap_out(roadmap)
