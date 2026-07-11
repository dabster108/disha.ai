"""Personalize a master roadmap for a student — progress and soft statuses only.

Never reorders phases/nodes or injects gap-only skills into the graph.
Gap skills absent from the master path are recorded in progress.meta.gap_extras.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.db.models import StudentProfile
from app.services.master_roadmap import (
    MasterRoadmapDocument,
    enrich_path_dict_with_master_metadata,
    load_master_roadmap,
    load_master_roadmap_fallback_from_gap,
)
from app.services.roadmap import (
    RoadmapPlan,
    SkillPathPlan,
    _attach_path_resources,
    seed_path_progress,
)
from app.services.skill_gap import normalize_skill_name

RECOMMENDED_TOP_N = 3


def _master_skill_keys(doc: MasterRoadmapDocument) -> set[str]:
    return {normalize_skill_name(node.skill) for phase in doc.phases for node in phase.nodes}


def _gap_extras(gap_data: dict, master_keys: set[str]) -> list[dict[str, Any]]:
    extras: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in gap_data.get("priority_learn") or []:
        skill = row.get("skill", "")
        key = normalize_skill_name(skill)
        if key and key not in master_keys and key not in seen:
            seen.add(key)
            extras.append({"skill": skill, "source": "priority_learn", "priority_score": row.get("priority_score")})
    for row in gap_data.get("market_missing_skills") or []:
        skill = row.get("skill", "")
        key = normalize_skill_name(skill)
        if key and key not in master_keys and key not in seen:
            seen.add(key)
            extras.append({"skill": skill, "source": "market_missing"})
    return extras


def _priority_scores(gap_data: dict) -> dict[str, float]:
    scores: dict[str, float] = {}
    for row in gap_data.get("priority_learn") or []:
        skill = row.get("skill", "")
        key = normalize_skill_name(skill)
        if key:
            scores[key] = float(row.get("priority_score") or 0)
    return scores


def _missing_skills(gap_data: dict) -> set[str]:
    return {normalize_skill_name(row.get("skill", "")) for row in gap_data.get("market_missing_skills") or []}


def annotate_node_statuses(path: dict | None, progress: dict, gap_data: dict | None = None) -> dict | None:
    """Soft-progression view with locked/recommended/active/upcoming/completed."""
    if not path:
        return path

    gap_data = gap_data or {}
    completed_nodes = set((progress or {}).get("completed_nodes") or [])
    priority = _priority_scores(gap_data)
    missing = _missing_skills(gap_data)

    completed_skill_keys = {
        normalize_skill_name(node.get("skill", ""))
        for phase in path.get("phases") or []
        for node in phase.get("nodes") or []
        if node.get("id") in completed_nodes
    }
    recommended_keys = {
        k
        for k, _ in sorted(priority.items(), key=lambda x: x[1], reverse=True)[:RECOMMENDED_TOP_N]
        if k not in completed_skill_keys
    }

    def deps_met(node: dict) -> bool:
        deps = node.get("dependencies") or []
        return all(dep in completed_nodes for dep in deps)

    next_is_active = True
    phases_out = []
    for phase in path.get("phases") or []:
        nodes_out = []
        for node in phase.get("nodes") or []:
            node = dict(node)
            nid = node.get("id")
            skill_key = normalize_skill_name(node.get("skill", ""))

            if nid in completed_nodes:
                node["status"] = "completed"
            elif node.get("dependencies") and not deps_met(node):
                node["status"] = "locked"
            elif skill_key in recommended_keys:
                node["status"] = "recommended"
                next_is_active = False
            elif next_is_active:
                node["status"] = "active"
                next_is_active = False
            else:
                node["status"] = "upcoming"

            if skill_key in missing:
                node["gap_flag"] = "missing"
            if skill_key in priority:
                node["priority_score"] = priority[skill_key]

            nodes_out.append(node)
        phases_out.append({**phase, "nodes": nodes_out})
    return {**path, "phases": phases_out}


def empty_weeks_plan(summary: str) -> RoadmapPlan:
    """Phase 1 stub — weeks derived from path in a later phase."""
    return RoadmapPlan(weeks=[], total_weeks=0, summary=summary)


async def build_user_roadmap(
    profile: StudentProfile,
    gap_data: dict,
) -> tuple[SkillPathPlan, dict, MasterRoadmapDocument]:
    """Load master roadmap, seed progress, attach resources, enrich metadata."""
    try:
        path_plan, doc = load_master_roadmap(profile.target_role)
    except (ValueError, FileNotFoundError):
        path_plan, doc = load_master_roadmap_fallback_from_gap(profile.target_role, gap_data)

    path_plan = await _attach_path_resources(path_plan, profile.budget)
    progress = seed_path_progress(profile, gap_data, path_plan)

    master_keys = _master_skill_keys(doc)
    extras = _gap_extras(gap_data, master_keys)
    progress = {
        **progress,
        "meta": {
            "roadmap_version": doc.roadmap_version,
            "role_key": doc.role_key,
            "gap_extras": extras,
        },
    }
    return path_plan, progress, doc


async def build_user_roadmap_dict(
    profile: StudentProfile,
    gap_data: dict,
) -> tuple[dict, dict, str]:
    """Convenience for API routes: path dict, progress dict, weeks summary."""
    path_plan, progress, doc = await build_user_roadmap(profile, gap_data)
    path_dict = enrich_path_dict_with_master_metadata(path_plan.model_dump(), doc)
    return path_dict, progress, doc.summary
