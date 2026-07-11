"""Regression tests for app.services.roadmap's generation entry points.

These exist specifically to catch "coroutine was never awaited" bugs: when
_attach_resources/_attach_path_resources became async (so resource lookup
could use MCP), one of their two call sites was missed — generate_skill_path
returned an unawaited coroutine instead of a SkillPathPlan, so every
POST /api/roadmap 500'd. The LLM call is mocked to return None so these run
fully offline, forcing both functions down their deterministic fallback path.
"""

import asyncio

from app.db.models import StudentProfile
from app.services import roadmap as rm


def _profile(**overrides):
    defaults = dict(target_role="Backend Developer", skills=["Python"], budget="free", time_per_week=10)
    defaults.update(overrides)
    return StudentProfile(**defaults)


def _gap_data():
    return {
        "priority_learn": [{"skill": "Docker", "priority_score": 80}],
        "market_missing_skills": [],
        "verified_weak_skills": [],
    }


def _patch_offline(monkeypatch):
    async def fake_call_structured(*args, **kwargs):
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

    monkeypatch.setattr(rm, "call_structured", fake_call_structured)
    monkeypatch.setattr(rm, "async_build_resources_for_skill", fake_resources)


def test_generate_roadmap_returns_resolved_plan_not_a_coroutine(monkeypatch):
    _patch_offline(monkeypatch)

    plan = asyncio.run(rm.generate_roadmap(_gap_data(), _profile(), "small"))

    assert not asyncio.iscoroutine(plan)
    assert plan.weeks
    for week in plan.weeks:
        for task in week.tasks:
            assert not asyncio.iscoroutine(task.resources)
            assert isinstance(task.resources, list)


def test_generate_skill_path_returns_resolved_plan_not_a_coroutine(monkeypatch):
    _patch_offline(monkeypatch)

    plan = asyncio.run(rm.generate_skill_path(_gap_data(), _profile(), "small"))

    assert not asyncio.iscoroutine(plan)
    assert plan.phases
    for phase in plan.phases:
        for node in phase.nodes:
            assert not asyncio.iscoroutine(node.resources)
            assert isinstance(node.resources, list)
