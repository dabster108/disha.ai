"""Learning curriculum endpoints — generate.md/regenerate a sectioned learning
curriculum (app.services.learning_agent) and track module-level progress.

Separate from the roadmap: the roadmap is a week-by-week schedule, the
curriculum is a self-paced, sectioned reading/practice list. Progress here
also nudges the roadmap forward when a module's skill matches a roadmap
node/task, so finishing a module counts toward both views instead of
requiring the student to tick the same thing twice.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models import LearningCurriculum, Roadmap, SkillGapSnapshot, StudentProfile
from app.orchestrator.tools.learning import get_roadmap_skeleton_tool
from app.services.learning_agent import generate_curriculum

router = APIRouter(prefix="/api/learning", tags=["learning"])


class GenerateRequest(BaseModel):
    profile_id: uuid.UUID
    force: bool = False


class CurriculumOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    sections: list
    summary: str | None
    progress: dict
    status: str
    created_at: datetime


class ProgressRequest(BaseModel):
    section_id: str
    module_id: str
    completed: bool = True
    source: Literal["manual", "scroll_complete", "resource_dwell"] = "manual"


async def _get_profile_or_404(db: AsyncSession, profile_id: uuid.UUID) -> StudentProfile:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


async def _latest_gap_data(db: AsyncSession, profile_id: uuid.UUID) -> dict:
    snapshot = (
        await db.execute(
            select(SkillGapSnapshot)
            .where(SkillGapSnapshot.profile_id == profile_id)
            .order_by(SkillGapSnapshot.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return snapshot.gap_data if snapshot and snapshot.gap_data else {}


@router.post("/generate", response_model=CurriculumOut, status_code=201)
async def generate(payload: GenerateRequest, db: AsyncSession = Depends(get_db)) -> LearningCurriculum:
    profile = await _get_profile_or_404(db, payload.profile_id)

    if not payload.force:
        existing = (
            await db.execute(
                select(LearningCurriculum)
                .where(LearningCurriculum.profile_id == profile.id, LearningCurriculum.status == "active")
                .order_by(LearningCurriculum.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    gap_data = await _latest_gap_data(db, profile.id)
    roadmap_skeleton = await get_roadmap_skeleton_tool.ainvoke({"profile_id": str(profile.id)})
    plan = await generate_curriculum(profile, gap_data, roadmap_skeleton)

    existing_active = (
        await db.execute(
            select(LearningCurriculum).where(
                LearningCurriculum.profile_id == profile.id, LearningCurriculum.status == "active"
            )
        )
    ).scalars().all()
    for c in existing_active:
        c.status = "replanned"

    curriculum = LearningCurriculum(
        profile_id=profile.id,
        sections=plan["sections"],
        summary=plan["summary"],
        status="active",
    )
    db.add(curriculum)
    await db.commit()
    return curriculum


@router.get("/{profile_id}", response_model=CurriculumOut)
async def latest(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> LearningCurriculum:
    curriculum = (
        await db.execute(
            select(LearningCurriculum)
            .where(LearningCurriculum.profile_id == profile_id, LearningCurriculum.status == "active")
            .order_by(LearningCurriculum.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if curriculum is None:
        raise HTTPException(status_code=404, detail="No curriculum yet — POST /api/learning/generate first.")
    return curriculum


def _find_module(sections: list, section_id: str, module_id: str) -> dict | None:
    for section in sections or []:
        if section.get("id") != section_id:
            continue
        for module in section.get("modules", []):
            if module.get("id") == module_id:
                return module
    return None


@router.patch("/{profile_id}/progress", response_model=CurriculumOut)
async def update_progress(
    profile_id: uuid.UUID, payload: ProgressRequest, db: AsyncSession = Depends(get_db)
) -> LearningCurriculum:
    curriculum = (
        await db.execute(
            select(LearningCurriculum)
            .where(LearningCurriculum.profile_id == profile_id, LearningCurriculum.status == "active")
            .order_by(LearningCurriculum.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if curriculum is None:
        raise HTTPException(status_code=404, detail="No active curriculum for this profile")

    module = _find_module(curriculum.sections, payload.section_id, payload.module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found in this curriculum")

    progress = dict(curriculum.progress or {})
    completed = list(progress.get("completed_modules", []))
    entry_key = f"{payload.section_id}:{payload.module_id}"
    exists = any(e["key"] == entry_key for e in completed)

    if payload.completed and not exists:
        completed.append({"key": entry_key, "source": payload.source, "completed_at": datetime.now(timezone.utc).isoformat()})
    elif not payload.completed and exists:
        completed = [e for e in completed if e["key"] != entry_key]

    progress["completed_modules"] = completed
    curriculum.progress = progress

    # Best-effort sync to the roadmap: if a roadmap node/task targets the same
    # skill, mark it complete too, so finishing a module here also advances
    # /roadmap instead of requiring the same thing ticked twice.
    if payload.completed:
        roadmap = (
            await db.execute(
                select(Roadmap).where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
            )
        ).scalar_one_or_none()
        if roadmap is not None:
            skill_key = (module.get("skill") or "").casefold()
            if roadmap.path and roadmap.path.get("phases"):
                matching_ids = {
                    node["id"]
                    for phase in roadmap.path["phases"]
                    for node in phase.get("nodes", [])
                    if (node.get("skill") or "").casefold() == skill_key
                }
                if matching_ids:
                    rprogress = dict(roadmap.progress or {})
                    completed_nodes = set(rprogress.get("completed_nodes", []))
                    rprogress["completed_nodes"] = list(completed_nodes | matching_ids)
                    roadmap.progress = rprogress

    await db.commit()
    return curriculum
