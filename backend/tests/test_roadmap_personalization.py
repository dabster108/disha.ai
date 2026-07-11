"""Tests for roadmap personalization (soft statuses, gap extras)."""

import asyncio

from app.db.models import StudentProfile
from app.services.master_roadmap import load_master_roadmap
from app.services.roadmap import seed_path_progress
from app.services.roadmap_personalization import (
    _gap_extras,
    annotate_node_statuses,
    build_user_roadmap,
    empty_weeks_plan,
)


def _profile(**overrides):
    defaults = dict(target_role="Backend Developer", skills=["Git", "Python"], budget="free", time_per_week=10)
    defaults.update(overrides)
    return StudentProfile(**defaults)


def _gap_data():
    return {
        "priority_learn": [
            {"skill": "Docker", "priority_score": 90},
            {"skill": "Kubernetes", "priority_score": 70},
        ],
        "market_missing_skills": [{"skill": "Caching"}],
        "matched_skills": [],
        "verified_strong_skills": [],
        "profile_evidence": {},
    }


def test_empty_weeks_plan():
    plan = empty_weeks_plan("Test summary")
    assert plan.weeks == []
    assert plan.total_weeks == 0
    assert plan.summary == "Test summary"


def test_gap_excludes_master_skills():
    plan, doc = load_master_roadmap("Backend Developer")
    master_keys = {n.skill.lower() for phase in doc.phases for n in phase.nodes}
    extras = _gap_extras(_gap_data(), {k.lower() for k in master_keys if k})
    extra_skills = {e["skill"] for e in extras}
    assert "Kubernetes" in extra_skills
    assert "Docker" not in extra_skills  # in backend master roadmap
    assert "Python" not in extra_skills


def test_annotate_locked_and_recommended():
    plan, doc = load_master_roadmap("Backend Developer")
    profile = _profile(skills=[])
    progress = seed_path_progress(profile, _gap_data(), plan)
    path = plan.model_dump()
    # attach deps from master metadata
    dep_by_id = {n.id: n.dependencies for phase in doc.phases for n in phase.nodes}
    for phase in path["phases"]:
        for node in phase["nodes"]:
            node["dependencies"] = dep_by_id.get(node["id"], [])

    annotated = annotate_node_statuses(path, progress, _gap_data())
    statuses = {n["skill"]: n["status"] for phase in annotated["phases"] for n in phase["nodes"]}

    assert statuses.get("Programming Fundamentals") == "active"
    # second node depends on first — should be locked until first is done
    assert statuses.get("Git") == "locked"


def test_build_user_roadmap_no_llm(monkeypatch):
    llm_called = {"n": 0}

    async def fake_llm(*args, **kwargs):
        llm_called["n"] += 1
        return None

    async def fake_resources(skill, *, budget=None, limit=3):
        return [
            {
                "title": f"{skill} video",
                "url": "https://www.youtube.com/watch?v=abc123def45",
                "provider": "YouTube",
                "type": "video",
                "cost": "free",
                "duration": None,
                "embed_url": "https://www.youtube.com/embed/abc123def45",
                "consume": "embed",
                "content_md": None,
            }
        ]

    from app.services import roadmap as rm

    monkeypatch.setattr(rm, "call_structured", fake_llm)
    monkeypatch.setattr(rm, "async_build_resources_for_skill", fake_resources)

    path_plan, progress, doc = asyncio.run(build_user_roadmap(_profile(), _gap_data()))

    assert llm_called["n"] == 0
    assert path_plan.phases
    assert progress.get("completed_nodes")
    assert progress.get("meta", {}).get("role_key") == "backend-developer"
    assert doc.roadmap_version
