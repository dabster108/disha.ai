"""Roadmap agent: turns a computed skill_gap into a week-by-week learning plan.

Reads gap_data produced by app.services.skill_gap — never recomputes the gap
itself. Depth (large vs. small gap) is decided once by classify_gap_size() and
reused by both the LangGraph router and this module, so the threshold lives
in exactly one place.
"""

from __future__ import annotations

import json
from typing import Literal

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.models import StudentProfile
from app.services.learning_resources import build_resources_for_skill
from app.services.llm_utils import call_structured

GapSize = Literal["large", "small"]


def classify_gap_size(gap_data: dict) -> GapSize:
    """Large gap -> full multi-week plan; small gap -> compact plan + interview prep."""
    missing = len(gap_data.get("market_missing_skills", []))
    weak = len(gap_data.get("verified_weak_skills", []))
    return "large" if (missing + weak) >= 5 else "small"


class RoadmapResource(BaseModel):
    """A concrete, clickable internet resource attached to a task (not LLM-authored)."""

    title: str
    url: str
    provider: str
    type: Literal["video", "article", "docs", "course", "practice"]
    cost: Literal["free", "paid"]
    duration: str | None = None


class RoadmapTask(BaseModel):
    title: str
    type: Literal["course", "project", "practice"]
    resource: str = Field(description="Concrete resource name, e.g. 'freeCodeCamp Docker course', 'Self-directed project'.")
    skill: str
    resources: list[RoadmapResource] = Field(
        default_factory=list,
        description="Real learning links — filled deterministically after generation, never by the LLM.",
    )


class RoadmapWeek(BaseModel):
    week: int
    theme: str
    hours: float = Field(description="Estimated hours this week — must not exceed the student's time_per_week.")
    tasks: list[RoadmapTask] = Field(default_factory=list, description="2-4 concrete tasks for the week.")


class RoadmapPlan(BaseModel):
    weeks: list[RoadmapWeek]
    total_weeks: int
    summary: str


def _fallback_roadmap(gap_data: dict, profile: StudentProfile, gap_size: GapSize, time_per_week: float) -> RoadmapPlan:
    priority = gap_data.get("priority_learn") or [{"skill": profile.target_role, "priority_score": 0}]
    max_skills = 4 if gap_size == "large" else 2
    hours = min(time_per_week, 12) if time_per_week else 10

    weeks: list[RoadmapWeek] = []
    week_num = 1
    for row in priority[:max_skills]:
        skill = row["skill"]
        weeks.append(
            RoadmapWeek(
                week=week_num,
                theme=f"{skill} fundamentals",
                hours=hours,
                tasks=[
                    RoadmapTask(title=f"Learn {skill} basics", type="course", resource="Free official docs / YouTube", skill=skill),
                    RoadmapTask(title=f"Build a small exercise using {skill}", type="practice", resource="Self-directed", skill=skill),
                ],
            )
        )
        week_num += 1
        weeks.append(
            RoadmapWeek(
                week=week_num,
                theme=f"{skill} applied project",
                hours=hours,
                tasks=[
                    RoadmapTask(title=f"Build a project using {skill}", type="project", resource="Self-directed", skill=skill),
                ],
            )
        )
        week_num += 1

    if gap_size == "small":
        weeks.append(
            RoadmapWeek(
                week=week_num,
                theme="Interview preparation",
                hours=hours,
                tasks=[
                    RoadmapTask(
                        title="Mock interview + skill practice review",
                        type="practice",
                        resource="Disha interview and practice modules",
                        skill=profile.target_role,
                    )
                ],
            )
        )
        week_num += 1

    skill_names = ", ".join(row["skill"] for row in priority[:max_skills]) or profile.target_role
    return RoadmapPlan(
        weeks=weeks,
        total_weeks=len(weeks),
        summary=f"Fallback plan for the {profile.target_role} role, focused on {skill_names}.",
    )


def _attach_resources(plan: RoadmapPlan, budget: str | None) -> RoadmapPlan:
    """Fill each task's `resources` with real, clickable links for its skill."""
    for week in plan.weeks:
        for task in week.tasks:
            if not task.resources:
                task.resources = [
                    RoadmapResource(**r)
                    for r in build_resources_for_skill(task.skill, budget=budget)
                ]
    return plan


async def generate_roadmap(gap_data: dict, profile: StudentProfile, gap_size: GapSize) -> RoadmapPlan:
    time_per_week = profile.time_per_week or 10
    budget = profile.budget or "free"
    depth_hint = (
        "This is a LARGE skill gap — produce a thorough plan (aim for around 8 weeks)."
        if gap_size == "large"
        else "This is a SMALLER skill gap — produce a compact plan (aim for around 4 weeks) "
        "and dedicate the final week to interview preparation."
    )
    prompt = (
        "You are Disha's roadmap planner for Nepali students.\n"
        "Given the skill_gap JSON and constraints below, output a week-by-week learning plan.\n"
        f"{depth_hint}\n"
        "Each week needs a theme, estimated hours (must not exceed time_per_week), and 2-4 concrete tasks with a skill tag.\n"
        "If budget is 'free', use YouTube, free docs, freeCodeCamp, free coding-practice tiers, and self-directed projects.\n"
        "If budget allows paid resources, you may mention Udemy courses or Nepal-based bootcamps generically, with NPR pricing context.\n"
        "Ground every task in a skill from priority_learn or market_missing_skills — do not invent skills not present in the data.\n"
        "Cite 1-2 real job titles from sample_jobs if present, to motivate the plan.\n\n"
        f"time_per_week: {time_per_week} hours\n"
        f"budget: {budget}\n"
        f"target_role: {profile.target_role}\n\n"
        f"skill_gap JSON:\n{json.dumps(gap_data, ensure_ascii=False)}"
    )
    settings = get_settings()
    llm = ChatGroq(model=settings.groq_model, temperature=0.3, api_key=settings.groq_api_key)
    result = await call_structured(llm, RoadmapPlan, prompt)
    plan = result if result is not None else _fallback_roadmap(gap_data, profile, gap_size, time_per_week)
    return _attach_resources(plan, profile.budget)
