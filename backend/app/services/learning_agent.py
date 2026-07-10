"""Learning curriculum agent — generates a sectioned, module-based curriculum
grounded in the student's actual skill gap and target role.

Ground rules that make this reliable rather than a black box:
- The LLM (Mistral, MISTRAL_API_KEY3) only ever writes a module's title,
  description, and which single catalog skill it teaches — it never writes a
  URL. Every module's `resources` are attached afterward from
  `app.services.learning_resources.build_resources_for_skill()` (a curated
  catalog + deterministic search deep-links), so no resource link is ever
  LLM-invented.
- Every module's skill is passed through `skills_catalog.normalize_skill()`;
  a skill the catalog doesn't recognize is dropped rather than kept as
  free text, so "skills catalog for all skill names" holds here too.
- Context (priority skills, role's catalog skills, roadmap skeleton) is
  gathered via the same tool functions in
  `app.orchestrator.tools.learning` before the LLM call — grounding the
  curriculum in real data without needing a full tool-calling agent loop
  (this codebase's other LLM features — interview, practice, roadmap, gap
  narrative — all use this same "gather context, then one structured-output
  call" shape rather than a ReAct loop, for reliability).
- Falls back to a deterministic curriculum (one module per priority skill)
  if the LLM call fails, same retry-then-fallback pattern as everywhere else.
"""

from __future__ import annotations

import re
import uuid
from functools import lru_cache
from typing import Literal

from langchain_mistralai import ChatMistralAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.models import StudentProfile
from app.services.learning_resources import build_resources_for_skill
from app.services.llm_utils import call_structured
from app.services.skills_catalog import normalize_skill, skills_for_role


class LearningModuleDraft(BaseModel):
    title: str
    description: str = Field(description="1-2 sentences: what this module covers and why it matters for the target role")
    skill: str = Field(description="The single skill this module teaches — must be one of the given priority/role skills")
    type: Literal["concept", "hands-on", "project"] = "concept"


class LearningSectionDraft(BaseModel):
    title: str = Field(description='Section name, e.g. "Foundations", "Core Skills", "Advanced"')
    modules: list[LearningModuleDraft]


class LearningCurriculumDraft(BaseModel):
    summary: str = Field(description="2-3 sentence overview of this curriculum's focus and structure")
    sections: list[LearningSectionDraft]


def _slugify(text: str, seen: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.casefold()).strip("-") or "module"
    slug = base
    i = 2
    while slug in seen:
        slug = f"{base}-{i}"
        i += 1
    seen.add(slug)
    return slug


@lru_cache
def _llm() -> ChatMistralAI:
    settings = get_settings()
    key = settings.mistral_api_key3 or settings.mistral_api_key2
    return ChatMistralAI(model=settings.learning_mistral_model, temperature=0.3, api_key=key)


def _fallback_curriculum(priority_skills: list[dict], role_skills: list[str], budget: str | None) -> dict:
    """Deterministic curriculum: one module per priority skill (or, if there
    are none yet, the role's top catalog skills) — no LLM involved."""
    names = [p["skill"] for p in priority_skills[:8]] or role_skills[:6]
    seen_ids: set[str] = set()
    modules = []
    for skill in names:
        canonical = normalize_skill(skill) or skill
        modules.append(
            {
                "id": _slugify(canonical, seen_ids),
                "title": canonical,
                "description": f"Build working knowledge of {canonical} for your target role.",
                "skill": canonical,
                "type": "concept",
                "resources": build_resources_for_skill(canonical, budget=budget),
            }
        )
    return {
        "summary": "A starter curriculum built from your top priority skills.",
        "sections": [{"id": "priority-skills", "title": "Priority Skills", "modules": modules}],
    }


async def generate_curriculum(
    profile: StudentProfile,
    gap_data: dict,
    roadmap_skeleton: dict | None = None,
) -> dict:
    priority_skills = (gap_data or {}).get("priority_learn", [])
    role_skills = skills_for_role(profile.target_role)

    if not priority_skills and not role_skills:
        return _fallback_curriculum([], [], profile.budget)

    priority_names = ", ".join(p["skill"] for p in priority_skills[:10]) or "(none yet)"
    role_skill_names = ", ".join(role_skills[:20])
    roadmap_summary = ""
    if roadmap_skeleton and roadmap_skeleton.get("phases"):
        roadmap_summary = "\n".join(
            f"- {p['title']}: {', '.join(p['skills'])}" for p in roadmap_skeleton["phases"][:6]
        )

    prompt = (
        "You are building a learning curriculum for a Nepali student preparing for a specific job role.\n"
        "Organize it into 2-4 sections (e.g. Foundations, Core Skills, Advanced), each with 2-5 modules.\n"
        "Each module teaches exactly ONE skill from the priority or role-skill lists below — do not invent "
        "skills outside these lists, and do not write a URL or resource link (those are attached separately).\n"
        "Prioritize the student's actual gap (priority skills) over generic role skills when both are given.\n\n"
        f"Target role: {profile.target_role}\n"
        f"Priority skills to close (ranked, most urgent first): {priority_names}\n"
        f"All catalog skills for this role: {role_skill_names}\n"
        f"Existing roadmap (avoid pure duplication, complement it):\n{roadmap_summary or '(none yet)'}\n"
    )

    result = await call_structured(_llm(), LearningCurriculumDraft, prompt)
    if result is None:
        return _fallback_curriculum(priority_skills, role_skills, profile.budget)

    seen_ids: set[str] = set()
    sections = []
    for section in result.sections:
        modules = []
        for module in section.modules:
            canonical = normalize_skill(module.skill)
            if canonical is None:
                continue  # catalog-only skill names — drop anything unrecognized
            modules.append(
                {
                    "id": _slugify(module.title, seen_ids),
                    "title": module.title,
                    "description": module.description,
                    "skill": canonical,
                    "type": module.type,
                    "resources": build_resources_for_skill(canonical, budget=profile.budget),
                }
            )
        if modules:
            sections.append({"id": _slugify(section.title, seen_ids), "title": section.title, "modules": modules})

    if not sections:
        return _fallback_curriculum(priority_skills, role_skills, profile.budget)

    return {"summary": result.summary, "sections": sections}
