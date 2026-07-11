"""Regression tests for app.services.roadmap's generation entry points.

Deterministic master roadmaps are the default (ROADMAP_USE_LLM=false). These
tests assert resolved plans (not coroutines) and that the default path never
calls Groq structured output.
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
    llm_calls = {"n": 0}

    async def fake_call_structured(*args, **kwargs):
        llm_calls["n"] += 1
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
    monkeypatch.setenv("ROADMAP_USE_LLM", "false")
    rm.get_settings.cache_clear()
    return llm_calls


def test_generate_roadmap_default_is_empty_weeks(monkeypatch):
    llm_calls = _patch_offline(monkeypatch)

    plan = asyncio.run(rm.generate_roadmap(_gap_data(), _profile(), "small"))

    assert llm_calls["n"] == 0
    assert not asyncio.iscoroutine(plan)
    assert plan.weeks == []
    assert plan.total_weeks == 0
    assert plan.summary


def test_generate_skill_path_returns_master_path_without_llm(monkeypatch):
    llm_calls = _patch_offline(monkeypatch)

    plan = asyncio.run(rm.generate_skill_path(_gap_data(), _profile(), "small"))

    assert llm_calls["n"] == 0
    assert not asyncio.iscoroutine(plan)
    assert plan.phases
    for phase in plan.phases:
        for node in phase.nodes:
            assert not asyncio.iscoroutine(node.resources)
            assert isinstance(node.resources, list)


def test_legacy_llm_path_still_works_when_flag_enabled(monkeypatch):
    llm_calls = _patch_offline(monkeypatch)
    monkeypatch.setenv("ROADMAP_USE_LLM", "true")
    rm.get_settings.cache_clear()

    plan = asyncio.run(rm.generate_roadmap(_gap_data(), _profile(), "small"))

    assert llm_calls["n"] == 1
    assert plan.weeks
