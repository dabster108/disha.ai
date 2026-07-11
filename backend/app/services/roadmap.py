"""Roadmap agent: turns a computed skill_gap into a week-by-week learning plan.

Reads gap_data produced by app.services.skill_gap — never recomputes the gap
itself. Depth (large vs. small gap) is decided once by classify_gap_size() and
reused by both the LangGraph router and this module, so the threshold lives
in exactly one place.
"""

from __future__ import annotations

import asyncio
import json
import re
from functools import lru_cache
from typing import Literal

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from app.config import get_settings
from app.rag.documents import infer_role_category
from app.services.skill_gap import normalize_skill_name, slim_gap_for_llm
from app.db.models import StudentProfile
from app.services.learning_resources import async_build_resources_for_skill
from app.services.llm_utils import call_structured

GapSize = Literal["large", "small"]


@lru_cache
def _llm() -> ChatGroq:
    settings = get_settings()
    return ChatGroq(model=settings.groq_model, temperature=0.3, api_key=settings.groq_api_key)


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
    # In-app consumption (app.services.learning_resources.normalize_resource) —
    # optional since these predate the Learning panel and stay unset for
    # resources that can only be opened as an external deep-link.
    embed_url: str | None = None
    consume: Literal["embed", "markdown"] | None = None
    content_md: str | None = None


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


async def _attach_resources(plan: RoadmapPlan, budget: str | None) -> RoadmapPlan:
    """Fill each task's `resources` with real, in-app-consumable resources for
    its skill. Looked up concurrently — sequentially awaiting one skill at a
    time would multiply MCP's per-call latency across every task in the plan."""
    pending = [task for week in plan.weeks for task in week.tasks if not task.resources]
    results = await asyncio.gather(
        *(async_build_resources_for_skill(task.skill, budget=budget) for task in pending)
    )
    for task, resources in zip(pending, results):
        task.resources = [RoadmapResource(**r) for r in resources]
    return plan


async def generate_roadmap(gap_data: dict, profile: StudentProfile, gap_size: GapSize) -> RoadmapPlan:
    """Week-by-week plan. Phase 1 uses empty weeks unless ROADMAP_USE_LLM=true."""
    if get_settings().roadmap_use_llm:
        return await _legacy_generate_roadmap(gap_data, profile, gap_size)
    from app.services.roadmap_personalization import build_user_roadmap, empty_weeks_plan

    _, _, doc = await build_user_roadmap(profile, gap_data)
    return empty_weeks_plan(doc.summary)


async def _legacy_generate_roadmap(gap_data: dict, profile: StudentProfile, gap_size: GapSize) -> RoadmapPlan:
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
        f"skill_gap JSON:\n{json.dumps(slim_gap_for_llm(gap_data), ensure_ascii=False)}"
    )
    result = await call_structured(_llm(), RoadmapPlan, prompt)
    plan = result if result is not None else _fallback_roadmap(gap_data, profile, gap_size, time_per_week)
    return await _attach_resources(plan, profile.budget)


# --------------------------------------------------------------------------
# Full skill path (roadmap.sh style) — complete role curriculum from zero.
#
# Unlike generate_roadmap() above (a 4-8 week gap-closure checklist), this
# builds the entire ladder for the role — fundamentals included — then
# seed_path_progress() auto-ticks whatever the student already knows from
# their profile, projects, and gap evidence. Progression is "soft": every
# node stays manually toggleable, this only decides what starts pre-checked
# and which node is highlighted as the recommended next step.
# --------------------------------------------------------------------------

# (role_category -> ordered phases -> ordered skills). Deterministic backbone
# for the LLM prompt and the guaranteed fallback if the LLM call fails.
FOUNDATIONAL_LADDERS: dict[str, list[tuple[str, list[str]]]] = {
    "frontend": [
        ("Foundations", ["HTML", "CSS", "JavaScript", "Git"]),
        ("Core Frontend", ["Responsive Design", "TypeScript", "React"]),
        ("Advanced Frontend", ["State Management", "Next.js", "Testing"]),
        ("Job Ready", ["REST API Integration", "Performance Optimization", "Deployment"]),
    ],
    "backend": [
        ("Foundations", ["Programming Fundamentals", "Git", "SQL"]),
        ("Core Backend", ["Python", "REST API", "Databases"]),
        ("Advanced Backend", ["Authentication", "Docker", "Caching"]),
        ("Job Ready", ["System Design Basics", "Testing", "Deployment"]),
    ],
    "fullstack": [
        ("Foundations", ["HTML", "CSS", "JavaScript", "Git"]),
        ("Frontend", ["React", "TypeScript"]),
        ("Backend", ["Node.js", "REST API", "SQL"]),
        ("Job Ready", ["Authentication", "Deployment", "Testing"]),
    ],
    "mobile": [
        ("Foundations", ["Programming Fundamentals", "Git", "UI Design Basics"]),
        ("Core Mobile", ["Flutter", "Mobile UI Patterns", "REST API Integration"]),
        ("Advanced Mobile", ["State Management", "Local Storage", "Push Notifications"]),
        ("Job Ready", ["App Store Deployment", "Testing", "Performance Optimization"]),
    ],
    "devops": [
        ("Foundations", ["Linux Basics", "Git", "Networking Basics"]),
        ("Core DevOps", ["Docker", "CI/CD", "AWS"]),
        ("Advanced DevOps", ["Kubernetes", "Infrastructure as Code", "Monitoring"]),
        ("Job Ready", ["Security Basics", "Incident Response", "Cost Optimization"]),
    ],
    "ml_ai": [
        ("Foundations", ["Python", "Statistics Basics", "Linear Algebra Basics"]),
        ("Core ML", ["Pandas", "Machine Learning", "Model Evaluation"]),
        ("Advanced ML", ["TensorFlow", "Deep Learning", "Feature Engineering"]),
        ("Job Ready", ["MLOps Basics", "Model Deployment", "Data Pipelines"]),
    ],
    "data": [
        ("Foundations", ["Excel", "SQL", "Statistics Basics"]),
        ("Core Data", ["Python", "Pandas", "Data Visualization"]),
        ("Advanced Data", ["ETL Pipelines", "Data Warehousing", "A/B Testing"]),
        ("Job Ready", ["Dashboarding", "Storytelling with Data", "Stakeholder Communication"]),
    ],
    "qa": [
        ("Foundations", ["Software Testing Basics", "Git", "SQL"]),
        ("Core QA", ["Test Case Design", "Manual Testing", "Bug Tracking"]),
        ("Advanced QA", ["Automation Testing", "API Testing", "CI/CD for Tests"]),
        ("Job Ready", ["Performance Testing", "Test Strategy", "Reporting"]),
    ],
    "design": [
        ("Foundations", ["Design Principles", "Typography", "Color Theory"]),
        ("Core Design", ["Figma", "Wireframing", "Prototyping"]),
        ("Advanced Design", ["Design Systems", "User Research", "Interaction Design"]),
        ("Job Ready", ["Portfolio Building", "Handoff to Developers", "Usability Testing"]),
    ],
}


def _generic_ladder(profile: StudentProfile, gap_data: dict) -> list[tuple[str, list[str]]]:
    """Role categories without a curated ladder (e.g. non-tech roles) still get a
    full-from-zero path, built from the student's own claimed skills plus the
    gap agent's market signal instead of a hand-authored curriculum."""
    claimed = [s.strip() for s in (profile.skills or []) if s and s.strip()]
    priority = [row["skill"] for row in (gap_data.get("priority_learn") or [])[:6]]
    missing = [s for s in (row["skill"] for row in (gap_data.get("market_missing_skills") or [])[:4]) if s not in priority]

    phases: list[tuple[str, list[str]]] = []
    if claimed:
        phases.append(("Foundations", claimed[:6]))
    if priority:
        phases.append(("Priority Skills", priority))
    if missing:
        phases.append(("Specialize", missing))
    phases.append(("Job Ready", [f"{profile.target_role} interview preparation", "Portfolio / project review"]))
    return phases


def build_role_skill_ladder(profile: StudentProfile, gap_data: dict) -> list[tuple[str, list[str]]]:
    """Deterministic skeleton: (phase title, [skill names]) from fundamentals to
    job-ready. Always starts from zero — gap-only skills are folded in as an
    extra "Specialize" phase rather than replacing the curated fundamentals."""
    role_category = infer_role_category(profile.target_role, profile.skills or [])
    ladder = FOUNDATIONAL_LADDERS.get(role_category)
    if ladder is None:
        return _generic_ladder(profile, gap_data)

    covered = {normalize_skill_name(skill) for _, skills in ladder for skill in skills}
    extra: list[str] = []
    for row in (gap_data.get("priority_learn") or [])[:6]:
        skill = row["skill"]
        if normalize_skill_name(skill) not in covered:
            covered.add(normalize_skill_name(skill))
            extra.append(skill)

    result = list(ladder)
    if extra:
        result.append(("Specialize & Close Gaps", extra))
    return result


class SkillPathResource(BaseModel):
    title: str
    url: str
    provider: str
    type: Literal["video", "article", "docs", "course", "practice"]
    cost: Literal["free", "paid"]
    duration: str | None = None
    embed_url: str | None = None
    consume: Literal["embed", "markdown"] | None = None
    content_md: str | None = None


class SkillPathNode(BaseModel):
    id: str
    skill: str
    title: str
    description: str = ""
    resources: list[SkillPathResource] = Field(default_factory=list)
    order: int = 0


class SkillPathPhase(BaseModel):
    id: str
    title: str
    nodes: list[SkillPathNode] = Field(default_factory=list)


class SkillPathPlan(BaseModel):
    schema_version: int = 1
    summary: str
    phases: list[SkillPathPhase]


class _SkillPathNodeDraft(BaseModel):
    skill: str = Field(description="Exact skill name, e.g. 'React', 'Docker'.")
    description: str = Field(description="One short sentence on what to learn and why it matters for the role.")


class _SkillPathPhaseDraft(BaseModel):
    title: str
    nodes: list[_SkillPathNodeDraft] = Field(
        default_factory=list, description="3-8 skill nodes for this phase, ordered from easiest to hardest."
    )


class _SkillPathPlanDraft(BaseModel):
    summary: str = Field(
        description="One sentence describing the full path, e.g. 'Full Frontend Developer path from zero to job-ready.'"
    )
    phases: list[_SkillPathPhaseDraft] = Field(
        description="4-6 phases moving from foundations to job-ready specialization. Never skip fundamentals."
    )


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("-", text.strip().casefold()).strip("-") or "node"


def _unique_id(base: str, seen: set[str]) -> str:
    candidate = base
    i = 2
    while candidate in seen:
        candidate = f"{base}-{i}"
        i += 1
    seen.add(candidate)
    return candidate


def _build_plan_from_ladder(ladder: list[tuple[str, list[str]]], profile: StudentProfile) -> SkillPathPlan:
    phases: list[SkillPathPhase] = []
    seen_node_ids: set[str] = set()
    seen_phase_ids: set[str] = set()
    order = 1
    for phase_title, skills in ladder:
        nodes: list[SkillPathNode] = []
        for skill in skills:
            node_id = _unique_id(_slugify(skill), seen_node_ids)
            nodes.append(SkillPathNode(id=node_id, skill=skill, title=skill, order=order))
            order += 1
        if nodes:
            phase_id = _unique_id(_slugify(phase_title), seen_phase_ids)
            phases.append(SkillPathPhase(id=phase_id, title=phase_title, nodes=nodes))
    return SkillPathPlan(summary=f"Full {profile.target_role} path from zero to job-ready.", phases=phases)


def _plan_from_draft(draft: _SkillPathPlanDraft, profile: StudentProfile) -> SkillPathPlan:
    phases: list[SkillPathPhase] = []
    seen_node_ids: set[str] = set()
    seen_phase_ids: set[str] = set()
    order = 1
    for phase_draft in draft.phases:
        nodes: list[SkillPathNode] = []
        for node_draft in phase_draft.nodes:
            skill = (node_draft.skill or "").strip()
            if not skill:
                continue
            node_id = _unique_id(_slugify(skill), seen_node_ids)
            nodes.append(
                SkillPathNode(
                    id=node_id, skill=skill, title=skill, description=node_draft.description or "", order=order
                )
            )
            order += 1
        if nodes:
            phase_id = _unique_id(_slugify(phase_draft.title), seen_phase_ids)
            phases.append(SkillPathPhase(id=phase_id, title=phase_draft.title, nodes=nodes))
    summary = draft.summary or f"Full {profile.target_role} path from zero to job-ready."
    return SkillPathPlan(summary=summary, phases=phases)


def _ensure_skeleton_coverage(plan: SkillPathPlan, ladder: list[tuple[str, list[str]]]) -> SkillPathPlan:
    """Safety net: the LLM must not drop fundamentals. Anything from the
    deterministic skeleton that's missing from its output gets appended as an
    extra leading phase instead of silently disappearing from the path."""
    covered = {normalize_skill_name(node.skill) for phase in plan.phases for node in phase.nodes}
    seen_node_ids = {node.id for phase in plan.phases for node in phase.nodes}
    max_order = max((node.order for phase in plan.phases for node in phase.nodes), default=0)

    missing: list[str] = []
    for _, skills in ladder:
        for skill in skills:
            key = normalize_skill_name(skill)
            if key not in covered:
                covered.add(key)
                missing.append(skill)

    if not missing:
        return plan

    nodes: list[SkillPathNode] = []
    for skill in missing:
        max_order += 1
        nodes.append(SkillPathNode(id=_unique_id(_slugify(skill), seen_node_ids), skill=skill, title=skill, order=max_order))
    extra_phase = SkillPathPhase(
        id=_unique_id("foundations", {phase.id for phase in plan.phases}),
        title="Foundations (Must-Know Basics)",
        nodes=nodes,
    )
    return plan.model_copy(update={"phases": [extra_phase, *plan.phases]})


async def _attach_path_resources(plan: SkillPathPlan, budget: str | None) -> SkillPathPlan:
    """Same concurrency reasoning as ``_attach_resources`` — a full skill path
    can have dozens of nodes, so resolve them all in parallel, not one at a time."""
    pending = [node for phase in plan.phases for node in phase.nodes if not node.resources]
    results = await asyncio.gather(
        *(async_build_resources_for_skill(node.skill, budget=budget) for node in pending)
    )
    for node, resources in zip(pending, results):
        node.resources = [SkillPathResource(**r) for r in resources]
    return plan


async def generate_skill_path(gap_data: dict, profile: StudentProfile, gap_size: GapSize) -> SkillPathPlan:
    """Full skill path. Master JSON by default unless ROADMAP_USE_LLM=true."""
    if get_settings().roadmap_use_llm:
        return await _legacy_generate_skill_path(gap_data, profile, gap_size)
    from app.services.roadmap_personalization import build_user_roadmap

    path_plan, _, _ = await build_user_roadmap(profile, gap_data)
    return path_plan


async def _legacy_generate_skill_path(gap_data: dict, profile: StudentProfile, gap_size: GapSize) -> SkillPathPlan:
    """The roadmap.sh-style full curriculum: every fundamental skill for the
    role, from zero, plus gap-driven specialization nodes. Auto-completion of
    already-known nodes happens separately in seed_path_progress()."""
    ladder = build_role_skill_ladder(profile, gap_data)
    skeleton_skills = [skill for _, skills in ladder for skill in skills]

    depth_hint = (
        "This is a LARGE skill gap — add a richer 'Specialize & Close Gaps' phase at the end."
        if gap_size == "large"
        else "This is a SMALLER skill gap — keep specialization light; the student is close to job-ready."
    )
    prompt = (
        "You are Disha's roadmap planner for Nepali students.\n"
        f"Build a COMPLETE job-ready curriculum from beginner to hire-ready for the role: {profile.target_role}.\n"
        "This is a full skill path from zero, not just a gap-closure list — include ALL fundamental skills "
        "even if the student already knows some of them (already-known nodes get auto-ticked separately).\n"
        "Group skills into 4-6 phases moving from foundations to job-ready specialization. Do not skip basics.\n"
        f"{depth_hint}\n"
        "You MUST include every skill listed in suggested_skeleton somewhere in the path — you may rename phase "
        "titles, reorder them, or add extra specialization skills from priority_learn / market_missing_skills, "
        "but never omit a skeleton skill.\n\n"
        f"suggested_skeleton (skills that must appear): {json.dumps(skeleton_skills, ensure_ascii=False)}\n"
        f"skill_gap JSON:\n{json.dumps(slim_gap_for_llm(gap_data), ensure_ascii=False)}\n"
        f"profile_evidence (skill levels, project tech stacks): "
        f"{json.dumps(gap_data.get('profile_evidence') or {}, ensure_ascii=False)}"
    )
    draft = await call_structured(_llm(), _SkillPathPlanDraft, prompt)
    if draft is None or not draft.phases:
        plan = _build_plan_from_ladder(ladder, profile)
    else:
        plan = _ensure_skeleton_coverage(_plan_from_draft(draft, profile), ladder)
    return await _attach_path_resources(plan, profile.budget)


def seed_path_progress(profile: StudentProfile, gap_data: dict, plan: SkillPathPlan) -> dict:
    """Auto-tick nodes the student already knows — soft progression, so every
    node stays manually toggleable afterward. Evidence, in priority order:
    verified test results > project tech stacks > self-rated profile skills
    > market-matched skills > plain CV claims."""
    known: dict[str, dict] = {}

    def _mark(skill: str, reason: str, source: str) -> None:
        key = normalize_skill_name(skill)
        if key:
            known[key] = {"reason": reason, "source": source}

    # Marked lowest-priority first — later calls overwrite earlier ones for
    # the same skill, so the last mark below wins and matches the priority
    # order documented above.
    for skill in profile.skills or []:
        _mark(skill, "Listed on your profile", "profile_skill")

    for entry in gap_data.get("matched_skills") or []:
        if entry.get("confidence") == "high" or entry.get("jobs_requiring", 0) >= 3:
            _mark(entry["skill"], "Matches market demand for your target role", "matched_skill")

    evidence = gap_data.get("profile_evidence") or {}
    for name, level in (evidence.get("skill_levels") or {}).items():
        if level in {"intermediate", "advanced", "expert"}:
            _mark(name, f"Self-rated {level} on your profile", "profile_meta")
    for skill in evidence.get("project_skills") or []:
        _mark(skill, "Used in one of your profile projects", "profile_meta")

    for entry in gap_data.get("verified_strong_skills") or []:
        _mark(entry["skill"], f"Proven strong in {entry.get('source', 'testing')}", "verified_strong")

    completed_nodes: list[str] = []
    auto_completed: list[dict] = []
    for phase in plan.phases:
        for node in phase.nodes:
            hit = known.get(normalize_skill_name(node.skill))
            if hit:
                completed_nodes.append(node.id)
                auto_completed.append({"node_id": node.id, **hit})

    return {
        "completed_nodes": completed_nodes,
        "auto_completed": auto_completed,
        "completed": [],
        "resources_completed": [],
    }


def compute_roadmap_progress_pct(roadmap) -> float:
    """0-100 completion percentage — mirrors frontend lib/journeyState.js's
    computeRoadmapProgress so the leaderboard/admin's number matches what the
    student sees on /roadmap and /dashboard exactly."""
    if roadmap is None:
        return 0.0

    path = roadmap.path or {}
    phases = path.get("phases") if isinstance(path, dict) else None
    if isinstance(phases, list) and phases:
        all_nodes = [node for phase in phases for node in (phase.get("nodes") or [])]
        completed_ids = set((roadmap.progress or {}).get("completed_nodes") or [])
        total = len(all_nodes)
        done = sum(1 for node in all_nodes if node.get("id") in completed_ids)
        return round((done / total) * 100, 1) if total else 0.0

    weeks = roadmap.weeks or []
    if not weeks:
        return 0.0
    completed = {(e["week"], e["task_index"]) for e in (roadmap.progress or {}).get("completed") or []}
    total = sum(len(w.get("tasks") or []) for w in weeks)
    done = sum(
        1
        for w in weeks
        for i in range(len(w.get("tasks") or []))
        if (w.get("week"), i) in completed
    )
    return round((done / total) * 100, 1) if total else 0.0
