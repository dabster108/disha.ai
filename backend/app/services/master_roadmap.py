"""Curated master roadmaps — deterministic role curricula loaded from JSON.

Master roadmaps are the source of truth for roadmap structure. Personalization
(see roadmap_personalization.py) only changes progress/status metadata, never
the skill graph order.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.services.roadmap import (
    FOUNDATIONAL_LADDERS,
    SkillPathNode,
    SkillPathPhase,
    SkillPathPlan,
    _slugify,
    _unique_id,
    build_role_skill_ladder,
)
from app.services.skill_gap import normalize_skill_name
from app.services.skills_catalog import load_catalog

ROADMAPS_DIR = Path(__file__).resolve().parents[1] / "data" / "roadmaps"

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class MasterRoadmapNode(BaseModel):
    id: str
    skill: str
    title: str
    description: str = ""
    order: int = 0
    dependencies: list[str] = Field(default_factory=list)
    estimated_hours: float | None = None
    suggested_projects: list[str] = Field(default_factory=list)
    difficulty: str | None = None


class MasterRoadmapPhase(BaseModel):
    id: str
    title: str
    milestones: list[str] = Field(default_factory=list)
    nodes: list[MasterRoadmapNode] = Field(default_factory=list)


class MasterRoadmapDocument(BaseModel):
    schema_version: int = 1
    roadmap_version: str
    role: str
    role_key: str
    role_aliases: list[str] = Field(default_factory=list)
    summary: str
    phases: list[MasterRoadmapPhase] = Field(default_factory=list)


# role_key -> (display role, FOUNDATIONAL_LADDERS category key)
_ROLE_REGISTRY: dict[str, tuple[str, str]] = {
    "frontend-developer": ("Frontend Developer", "frontend"),
    "backend-developer": ("Backend Developer", "backend"),
    "fullstack-developer": ("Full Stack Developer", "fullstack"),
    "mobile-developer": ("Mobile App Developer", "mobile"),
    "devops-engineer": ("DevOps Engineer", "devops"),
    "ai-ml-engineer": ("AI / ML Engineer", "ml_ai"),
    "data-scientist": ("Data Scientist", "data"),
    "qa-engineer": ("QA / Test Engineer", "qa"),
    "ui-ux-designer": ("UI/UX Designer", "design"),
    "cloud-engineer": ("Cloud Engineer", "devops"),
    "cybersecurity-analyst": ("Cybersecurity Analyst", "qa"),
}


def _role_key_slug(text: str) -> str:
    return _SLUG_RE.sub("-", (text or "").strip().casefold()).strip("-") or "role"


def _infer_role_category_from_title(title: str) -> str | None:
    """Lightweight role→category map without pulling in RAG/scraper imports."""
    t = (title or "").casefold()
    hints: list[tuple[str, str]] = [
        ("frontend", "frontend"),
        ("backend", "backend"),
        ("full stack", "fullstack"),
        ("fullstack", "fullstack"),
        ("full-stack", "fullstack"),
        ("devops", "devops"),
        ("mobile", "mobile"),
        ("machine learning", "ml_ai"),
        ("ml engineer", "ml_ai"),
        ("ai / ml", "ml_ai"),
        ("data scientist", "data"),
        ("data analyst", "data"),
        ("qa", "qa"),
        ("test engineer", "qa"),
        ("ui/ux", "design"),
        ("ux designer", "design"),
        ("cloud engineer", "devops"),
        ("cybersecurity", "qa"),
        ("security analyst", "qa"),
    ]
    for needle, category in hints:
        if needle in t:
            return category
    return None


def resolve_role_key(target_role: str) -> str | None:
    """Map profile.target_role to a master roadmap role_key."""
    role = (target_role or "").strip()
    if not role:
        return None

    role_cf = role.casefold()
    for role_key, (display, _) in _ROLE_REGISTRY.items():
        if display.casefold() == role_cf or role_key.replace("-", " ") in role_cf or role_cf in display.casefold():
            return role_key

    catalog = load_catalog()
    if role in catalog.roles:
        slug = _role_key_slug(role)
        if slug in _ROLE_REGISTRY:
            return slug
        category = _infer_role_category_from_title(role)
        for key, (_, cat) in _ROLE_REGISTRY.items():
            if cat == category:
                return key

    for name in catalog.roles:
        if name.casefold() in role_cf or role_cf in name.casefold():
            slug = _role_key_slug(name)
            if slug in _ROLE_REGISTRY:
                return slug

    category = _infer_role_category_from_title(role)
    for key, (_, cat) in _ROLE_REGISTRY.items():
        if cat == category:
            return key
    return None


def validate_dependency_dag(phases: list[MasterRoadmapPhase]) -> None:
    """Raise ValueError if dependencies reference unknown ids or form cycles."""
    node_ids = {node.id for phase in phases for node in phase.nodes}
    graph: dict[str, list[str]] = {nid: [] for nid in node_ids}

    for phase in phases:
        for node in phase.nodes:
            for dep in node.dependencies:
                if dep not in node_ids:
                    raise ValueError(f"Node {node.id!r} depends on unknown id {dep!r}")
                graph[node.id].append(dep)

    visiting: set[str] = set()
    visited: set[str] = set()

    def dfs(nid: str) -> None:
        if nid in visiting:
            raise ValueError(f"Dependency cycle detected at node {nid!r}")
        if nid in visited:
            return
        visiting.add(nid)
        for dep in graph.get(nid, []):
            dfs(dep)
        visiting.remove(nid)
        visited.add(nid)

    for nid in node_ids:
        dfs(nid)


def _linear_dependencies(phases: list[tuple[str, list[str]]]) -> dict[str, list[str]]:
    """Previous node in global order is the sole dependency (simple linear path)."""
    deps: dict[str, list[str]] = {}
    prev_id: str | None = None
    for phase_title, skills in phases:
        for skill in skills:
            nid = _slugify(skill)
            deps[nid] = [prev_id] if prev_id else []
            prev_id = nid
    return deps


def build_master_document_from_ladder(
    role_key: str,
    role_display: str,
    ladder: list[tuple[str, list[str]]],
    *,
    roadmap_version: str | None = None,
) -> MasterRoadmapDocument:
    dep_map = _linear_dependencies(ladder)
    phases: list[MasterRoadmapPhase] = []
    seen_phase_ids: set[str] = set()
    order = 1

    for phase_title, skills in ladder:
        nodes: list[MasterRoadmapNode] = []
        for skill in skills:
            nid = _slugify(skill)
            nodes.append(
                MasterRoadmapNode(
                    id=nid,
                    skill=skill,
                    title=skill,
                    description=f"Learn {skill} for {role_display}.",
                    order=order,
                    dependencies=list(dep_map.get(nid, [])),
                    estimated_hours=6.0,
                    suggested_projects=[f"Apply {skill} in a small project"],
                    difficulty="beginner" if order <= 4 else "intermediate",
                )
            )
            order += 1
        if nodes:
            pid = _unique_id(_slugify(phase_title), seen_phase_ids)
            phases.append(
                MasterRoadmapPhase(
                    id=pid,
                    title=phase_title,
                    milestones=[f"Complete {phase_title.lower()} skills"],
                    nodes=nodes,
                )
            )

    doc = MasterRoadmapDocument(
        schema_version=1,
        roadmap_version=roadmap_version or f"{role_key}-v1",
        role=role_display,
        role_key=role_key,
        role_aliases=[role_display],
        summary=f"Full {role_display} path from zero to job-ready.",
        phases=phases,
    )
    validate_dependency_dag(doc.phases)
    return doc


def master_document_to_skill_path(doc: MasterRoadmapDocument) -> SkillPathPlan:
    """Convert a master document to the persisted SkillPathPlan shape."""
    phases: list[SkillPathPhase] = []
    for phase in doc.phases:
        nodes = [
            SkillPathNode(
                id=node.id,
                skill=node.skill,
                title=node.title,
                description=node.description,
                order=node.order,
                resources=[],
            )
            for node in phase.nodes
        ]
        phases.append(SkillPathPhase(id=phase.id, title=phase.title, nodes=nodes))

    return SkillPathPlan(
        schema_version=doc.schema_version,
        summary=doc.summary,
        phases=phases,
    )


def enrich_path_dict_with_master_metadata(path_dict: dict, doc: MasterRoadmapDocument) -> dict:
    """Attach master-only fields for read-time status annotation and UI metadata."""
    meta_by_id = {
        node.id: node.model_dump()
        for phase in doc.phases
        for node in phase.nodes
    }
    out = dict(path_dict)
    out["roadmap_version"] = doc.roadmap_version
    out["role_key"] = doc.role_key
    phases_out = []
    for phase in path_dict.get("phases") or []:
        phase_copy = dict(phase)
        nodes_out = []
        for node in phase.get("nodes") or []:
            node_copy = dict(node)
            master = meta_by_id.get(node.get("id"), {})
            node_copy["dependencies"] = master.get("dependencies", [])
            node_copy["estimated_hours"] = master.get("estimated_hours")
            node_copy["suggested_projects"] = master.get("suggested_projects", [])
            node_copy["difficulty"] = master.get("difficulty")
            nodes_out.append(node_copy)
        phase_copy["nodes"] = nodes_out
        phase_copy["milestones"] = next(
            (p.milestones for p in doc.phases if p.id == phase.get("id")),
            [],
        )
        phases_out.append(phase_copy)
    out["phases"] = phases_out
    return out


@lru_cache
def _load_json_file(path_str: str, mtime_ns: int) -> MasterRoadmapDocument:
    del mtime_ns  # bust cache when file changes
    raw = json.loads(Path(path_str).read_text(encoding="utf-8"))
    doc = MasterRoadmapDocument.model_validate(raw)
    validate_dependency_dag(doc.phases)
    return doc


def load_master_document(role_key: str) -> MasterRoadmapDocument:
    path = ROADMAPS_DIR / f"{role_key}.json"
    if path.is_file():
        return _load_json_file(str(path), path.stat().st_mtime_ns)

    if role_key not in _ROLE_REGISTRY:
        raise FileNotFoundError(f"No master roadmap for role_key={role_key!r}")

    display, category = _ROLE_REGISTRY[role_key]
    ladder = FOUNDATIONAL_LADDERS.get(category)
    if ladder is None:
        raise FileNotFoundError(f"No ladder for category={category!r}")
    return build_master_document_from_ladder(role_key, display, ladder)


def load_master_roadmap(target_role: str) -> tuple[SkillPathPlan, MasterRoadmapDocument]:
    """Load curated master roadmap for a target role."""
    role_key = resolve_role_key(target_role)
    if role_key is None:
        raise ValueError(f"No master roadmap matches target_role={target_role!r}")

    doc = load_master_document(role_key)
    plan = master_document_to_skill_path(doc)
    return plan, doc


def load_master_roadmap_fallback_from_gap(
    target_role: str, gap_data: dict
) -> tuple[SkillPathPlan, MasterRoadmapDocument]:
    """When no JSON/registry match, build from FOUNDATIONAL_LADDERS + gap ladder."""
    from app.db.models import StudentProfile

    profile = StudentProfile(target_role=target_role, skills=[])
    ladder = build_role_skill_ladder(profile, gap_data)
    role_key = resolve_role_key(target_role) or _role_key_slug(target_role)
    display = target_role or "Career Path"
    doc = build_master_document_from_ladder(role_key, display, ladder)
    return master_document_to_skill_path(doc), doc


def list_available_roadmaps() -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    if ROADMAPS_DIR.is_dir():
        for path in sorted(ROADMAPS_DIR.glob("*.json")):
            doc = _load_json_file(str(path), path.stat().st_mtime_ns)
            results.append(
                {
                    "role_key": doc.role_key,
                    "role": doc.role,
                    "roadmap_version": doc.roadmap_version,
                    "phase_count": len(doc.phases),
                    "node_count": sum(len(p.nodes) for p in doc.phases),
                    "source": "json",
                }
            )
    for role_key in _ROLE_REGISTRY:
        if not (ROADMAPS_DIR / f"{role_key}.json").is_file():
            display, category = _ROLE_REGISTRY[role_key]
            ladder = FOUNDATIONAL_LADDERS.get(category, [])
            results.append(
                {
                    "role_key": role_key,
                    "role": display,
                    "roadmap_version": f"{role_key}-v1",
                    "phase_count": len(ladder),
                    "node_count": sum(len(skills) for _, skills in ladder),
                    "source": "ladder_fallback",
                }
            )
    return results
