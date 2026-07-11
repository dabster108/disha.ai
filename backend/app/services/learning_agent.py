"""Learning curriculum agent — generates a sectioned, module-based curriculum
grounded in the student's skill gap, profile constraints, and target role.

Pipeline (gather → write → attach resources):
1. Context is gathered from profile + gap + roadmap (same tool functions as
   ``app.orchestrator.tools.learning``).
2. One structured Mistral call writes in-app lessons (explanation, steps,
   examples, mini-checks) tailored to that student — not generic blurbs.
3. For each module skill, ``get_learning_resources_tool`` /
   ``async_build_resources_for_skill`` attaches real, in-app-consumable
   resources — YouTube embeds or Context7 docs, never LLM-invented URLs and
   never a link that redirects the student out of the app. Budget filters
   paid options.

Falls back to a short deterministic skeleton if the LLM call fails.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Literal

from langchain_mistralai import ChatMistralAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.models import StudentProfile
from app.orchestrator.tools.learning import get_learning_resources_tool
from app.services.llm_utils import call_structured
from app.services.skills_catalog import normalize_skill, skills_for_role


class MiniCheckDraft(BaseModel):
    question: str = Field(description="A short self-check question the student answers in their head")
    answer: str = Field(description="The correct answer/explanation, shown after the student checks their understanding")


class LearningModuleDraft(BaseModel):
    title: str
    skill: str = Field(description="The single skill this module teaches — must be one of the given priority/role skills")
    type: Literal["concept", "hands-on", "project"] = "concept"
    explanation: str = Field(
        description=(
            "2-4 short paragraphs teaching this skill for THIS student's role and gap reason. "
            "Be concrete: tools, commands, scenarios a junior hire in Nepal would face. "
            "Do NOT write vague marketing copy like 'this module focuses on developing…'."
        )
    )
    steps: list[str] = Field(description="3-5 concrete practice steps the student can do this week")
    examples: list[str] = Field(
        description="1-2 worked examples (commands, config snippets, or role-specific scenarios)"
    )
    mini_checks: list[MiniCheckDraft] = Field(
        description="1-2 short self-check questions with answers"
    )


class LearningSectionDraft(BaseModel):
    title: str = Field(description='Section name, e.g. "Foundations", "Core Skills", "Advanced"')
    modules: list[LearningModuleDraft]


class LearningCurriculumDraft(BaseModel):
    summary: str = Field(description="2-3 sentence overview tailored to this student's role and gaps")
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
    # Explicit max_tokens matters here: with it unset, Mistral's structured
    # tool-call output was silently truncated mid-module for a curriculum
    # this size (2-3 sections x 2-3 rich modules), which surfaces as a
    # pydantic ValidationError (missing fields) that call_structured swallows
    # into a fallback. 16000 gives enough headroom for the full curriculum.
    return ChatMistralAI(
        model=settings.learning_mistral_model, temperature=0.3, api_key=key, max_tokens=16000
    )


async def _attach_resources(modules: list[dict], *, budget: str | None) -> None:
    """Call the learning-resources tool once per module skill (deterministic)."""
    for module in modules:
        skill = module.get("skill") or ""
        if not skill:
            module["resources"] = []
            continue
        module["resources"] = await get_learning_resources_tool.ainvoke(
            {"skill": skill, "budget": budget or "free", "limit": 3}
        )


async def _fallback_module(skill: str, seen_ids: set[str], *, budget: str | None = "free") -> dict:
    module = {
        "id": _slugify(skill, seen_ids),
        "title": skill,
        "skill": skill,
        "type": "concept",
        "explanation": (
            f"This module covers {skill}. The full lesson couldn't be generated right now — "
            f"start with the linked resources below, then regenerate for a complete in-app lesson."
        ),
        "steps": [
            f"Open the top resource for {skill} and complete one section",
            f"Note 3 ways {skill} shows up in your target role",
            "Regenerate this curriculum for a full written lesson",
        ],
        "examples": [],
        "mini_checks": [
            {
                "question": f"Can you explain {skill} in your own words?",
                "answer": "Regenerate the curriculum for a model answer.",
            }
        ],
    }
    await _attach_resources([module], budget=budget)
    return module


async def _fallback_curriculum(
    priority_skills: list[dict], role_skills: list[str], *, budget: str | None = "free"
) -> dict:
    """Deterministic curriculum: one placeholder module per priority skill."""
    names = [p["skill"] for p in priority_skills[:8]] or role_skills[:6]
    seen_ids: set[str] = set()
    modules = [
        await _fallback_module(normalize_skill(skill) or skill, seen_ids, budget=budget)
        for skill in names
    ]
    return {
        "summary": "A starter curriculum from your top priority skills — regenerate for full lessons.",
        "sections": [{"id": "priority-skills", "title": "Priority Skills", "modules": modules}],
    }


FALLBACK_SUMMARY_PREFIX = "A starter curriculum from your top priority skills"


def is_fallback_curriculum_summary(summary: str | None) -> bool:
    return bool(summary and summary.startswith(FALLBACK_SUMMARY_PREFIX))


def is_fallback_curriculum_plan(plan: dict) -> bool:
    return is_fallback_curriculum_summary(plan.get("summary"))


def _format_priority_block(priority_skills: list[dict]) -> str:
    lines = []
    for p in priority_skills[:10]:
        skill = p.get("skill") or "?"
        reason = (p.get("reason") or "").strip()
        score = p.get("priority_score")
        score_bit = f" (priority {score})" if score is not None else ""
        if reason:
            lines.append(f"- {skill}{score_bit}: {reason}")
        else:
            lines.append(f"- {skill}{score_bit}")
    return "\n".join(lines) or "(none yet)"


def _claimed_skills_line(profile: StudentProfile) -> str:
    skills = profile.skills or []
    if not skills:
        return "(none listed)"
    return ", ".join(str(s) for s in skills[:25])


async def generate_curriculum(
    profile: StudentProfile,
    gap_data: dict,
    roadmap_skeleton: dict | None = None,
) -> dict:
    priority_skills = (gap_data or {}).get("priority_learn", [])
    role_skills = skills_for_role(profile.target_role)
    budget = profile.budget or "free"

    if not priority_skills and not role_skills:
        return await _fallback_curriculum([], [], budget=budget)

    role_skill_names = ", ".join(role_skills[:20])
    roadmap_summary = ""
    if roadmap_skeleton and roadmap_skeleton.get("phases"):
        roadmap_summary = "\n".join(
            f"- {p['title']}: {', '.join(p['skills'])}" for p in roadmap_skeleton["phases"][:6]
        )

    experience = profile.years_of_experience
    exp_label = f"{experience} years" if experience is not None else "not specified"
    time_pw = profile.time_per_week or "not specified"
    location = profile.location or "Nepal"

    prompt = (
        "You are writing a personalized learning curriculum for ONE Nepali student. "
        "Each module is an in-app lesson they read here; real external resources are "
        "attached separately by the system — do NOT invent or list URLs.\n\n"
        "RULES:\n"
        "- Organize into 2-3 sections (e.g. Foundations, Core Skills, Role-Specific Gaps), "
        "each with 2-3 modules. Depth over breadth.\n"
        "- Each module teaches exactly ONE skill from the priority or role-skill lists — "
        "do not invent skills outside these lists.\n"
        "- Prioritize priority-gap skills over generic role skills.\n"
        "- Tailor every explanation to THIS student's target role, experience level, "
        "gap reason, and time budget. Use concrete DevOps/engineering scenarios when "
        "the role is technical (standups, incident notes, PRs, pipelines, on-call).\n"
        "- FORBIDDEN: vague filler like \"This module focuses on developing…\", "
        "\"essential for collaborating…\", \"fundamentals which are essential…\". "
        "Start teaching immediately with what to learn and why it matters for their role.\n"
        "- For soft skills (e.g. Communication), teach role-specific practice: writing "
        "clear Slack updates, incident summaries, PR descriptions — not generic soft-skill essays.\n"
        "- For each module: 2-4 short teaching paragraphs, 3-5 doable steps, 1-2 worked "
        "examples, 1-2 mini self-checks with answers.\n\n"
        f"Target role: {profile.target_role}\n"
        f"Location: {location}\n"
        f"Years of experience: {exp_label}\n"
        f"Hours available per week: {time_pw}\n"
        f"Budget for paid courses: {budget}\n"
        f"Skills they already claim: {_claimed_skills_line(profile)}\n\n"
        f"Priority skills to close (with WHY they matter for this student):\n"
        f"{_format_priority_block(priority_skills)}\n\n"
        f"All catalog skills for this role: {role_skill_names}\n"
        f"Existing roadmap (complement, don't duplicate):\n{roadmap_summary or '(none yet)'}\n"
    )

    result = await call_structured(_llm(), LearningCurriculumDraft, prompt)
    if result is None:
        return await _fallback_curriculum(priority_skills, role_skills, budget=budget)

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
                    "skill": canonical,
                    "type": module.type,
                    "explanation": module.explanation,
                    "steps": module.steps,
                    "examples": module.examples,
                    "mini_checks": [
                        {"question": c.question, "answer": c.answer} for c in module.mini_checks
                    ],
                }
            )
        if modules:
            await _attach_resources(modules, budget=budget)
            sections.append(
                {"id": _slugify(section.title, seen_ids), "title": section.title, "modules": modules}
            )

    if not sections:
        return await _fallback_curriculum(priority_skills, role_skills, budget=budget)

    return {"summary": result.summary, "sections": sections}
