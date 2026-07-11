"""Debug learning curriculum generation for a profile."""

from __future__ import annotations

import asyncio
import sys
import uuid

from app.db.models import StudentProfile
from app.db.session import async_session_factory
from app.orchestrator.tools.learning import get_roadmap_skeleton_tool
from app.services.learning_agent import (
    LearningCurriculumDraft,
    _claimed_skills_line,
    _format_priority_block,
    _llm,
    generate_curriculum,
)
from app.services.llm_utils import call_structured
from app.services.skill_gap import get_or_create_current_snapshot
from app.services.skills_catalog import normalize_skill, skills_for_role


async def main(profile_id: uuid.UUID) -> None:
    async with async_session_factory() as db:
        profile = await db.get(StudentProfile, profile_id)
        if profile is None:
            print("profile not found")
            return
        snap = await get_or_create_current_snapshot(db, profile)
        gap = snap.gap_data or {}

    roadmap = await get_roadmap_skeleton_tool.ainvoke({"profile_id": str(profile_id)})
    priority = gap.get("priority_learn", [])
    role_skills = skills_for_role(profile.target_role)
    roadmap_summary = "\n".join(
        f"- {p['title']}: {', '.join(p['skills'])}" for p in roadmap.get("phases", [])[:6]
    )

    prompt = (
        "You are writing a personalized learning curriculum for ONE Nepali student. "
        "Each module is an in-app lesson. Do NOT invent URLs.\n"
        "Organize into 2-3 sections with 2-3 modules each. "
        "Each module teaches ONE skill from priority or role lists.\n"
        f"Target role: {profile.target_role}\n"
        f"Priority skills:\n{_format_priority_block(priority)}\n"
        f"Role skills: {', '.join(role_skills[:20])}\n"
        f"Skills they claim: {_claimed_skills_line(profile)}\n"
        f"Roadmap:\n{roadmap_summary or '(none)'}\n"
    )

    print("--- structured LLM call ---")
    result = await call_structured(_llm(), LearningCurriculumDraft, prompt)
    print("result is None:", result is None)
    if result:
        print("summary:", result.summary[:120])
        for si, section in enumerate(result.sections):
            print(f"section {si}: {section.title} modules={len(section.modules)}")
            for mi, module in enumerate(section.modules):
                canon = normalize_skill(module.skill)
                print(f"  mod {mi}: skill={module.skill!r} canon={canon!r}")

    print("\n--- full generate_curriculum ---")
    plan = await generate_curriculum(profile, gap, roadmap)
    print("summary:", plan.get("summary", "")[:120])
    for section in plan.get("sections", []):
        for module in section.get("modules", []):
            print(" module:", module.get("title"), "|", module.get("explanation", "")[:80])


if __name__ == "__main__":
    pid = uuid.UUID(sys.argv[1]) if len(sys.argv) > 1 else uuid.UUID("bb79602c-6d37-4fdc-b8ce-3d30a60e2b00")
    asyncio.run(main(pid))
