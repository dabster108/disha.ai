"""Regression tests for the intake/gap/roadmap node latency fixes.

No real DB — async_session_factory is monkeypatched per node module, and
load_gap_context / generate_gap_narrative / build_user_roadmap_dict are
replaced with instrumented fakes so we can assert on call counts and overlap
without touching Postgres. Matches this suite's existing convention
(test_roadmap_generation.py) of driving coroutines with asyncio.run() rather
than pytest-asyncio, which isn't a dependency here.
"""

from __future__ import annotations

import asyncio
import uuid

from app.orchestrator.nodes import gap as gap_module
from app.orchestrator.nodes import intake as intake_module
from app.orchestrator.nodes import roadmap as roadmap_module
from app.services.skill_gap import GapContext


class _FakeProfile:
    def __init__(self, id_):
        self.id = id_
        self.skills = ["Python"]
        self.target_role = "Backend Developer"
        self.location = None
        self.time_per_week = 10
        self.budget = "free"
        self.full_name = "Bench"


def _fake_session_factory(profile):
    calls = {"db.get": 0}

    class _Session:
        async def get(self, model, pk, **kwargs):
            calls["db.get"] += 1
            return profile

    class _Ctx:
        async def __aenter__(self):
            return _Session()

        async def __aexit__(self, *exc):
            return False

    factory = lambda: _Ctx()  # noqa: E731
    factory.calls = calls
    return factory


def test_intake_node_stores_profile_in_state(monkeypatch):
    profile_id = uuid.uuid4()
    profile = _FakeProfile(profile_id)
    factory = _fake_session_factory(profile)
    monkeypatch.setattr(intake_module, "async_session_factory", factory)

    result = asyncio.run(intake_module.intake_node({"profile_id": str(profile_id)}))

    assert result["profile"] is profile
    assert factory.calls["db.get"] == 1


def test_gap_node_reuses_cached_profile_and_defers_narrative_when_roadmap_runs(monkeypatch):
    profile_id = uuid.uuid4()
    profile = _FakeProfile(profile_id)
    factory = _fake_session_factory(profile)
    monkeypatch.setattr(gap_module, "async_session_factory", factory)

    seen_profile_arg = {}

    async def fake_load_gap_context(db, pid, *, interview_session_id=None, practice_session_id=None, n_jobs=20, profile=None):
        seen_profile_arg["profile"] = profile
        # Real load_gap_context would re-fetch when profile is None — assert
        # the node passed the cached one through instead.
        return GapContext(profile=profile or _FakeProfile(pid), interview=None, practice=None, n_jobs=n_jobs)

    narrative_calls = {"n": 0}

    async def fake_generate_gap_narrative(gap_data, profile):
        narrative_calls["n"] += 1
        return "narrative"

    monkeypatch.setattr(gap_module, "load_gap_context", fake_load_gap_context)
    monkeypatch.setattr(
        gap_module,
        "compute_combined_skill_gap",
        lambda ctx: {"priority_learn": [], "market_missing_skills": [], "verified_weak_skills": []},
    )
    monkeypatch.setattr(gap_module, "generate_gap_narrative", fake_generate_gap_narrative)

    state = {
        "profile_id": str(profile_id),
        "profile": profile,
        "include_narrative": True,
        "run_roadmap": True,
    }
    result = asyncio.run(gap_module.gap_node(state))

    assert seen_profile_arg["profile"] is profile, "gap_node must pass the cached profile through to load_gap_context"
    assert factory.calls["db.get"] == 0, "gap_node must not re-fetch a profile it already has"
    assert narrative_calls["n"] == 0, "narrative must be deferred to roadmap_node when roadmap will also run"
    assert result["narrative_summary"] is None


def test_gap_node_generates_narrative_when_roadmap_wont_run(monkeypatch):
    profile_id = uuid.uuid4()
    profile = _FakeProfile(profile_id)
    factory = _fake_session_factory(profile)
    monkeypatch.setattr(gap_module, "async_session_factory", factory)

    async def fake_load_gap_context(db, pid, *, interview_session_id=None, practice_session_id=None, n_jobs=20, profile=None):
        return GapContext(profile=profile, interview=None, practice=None, n_jobs=n_jobs)

    narrative_calls = {"n": 0}

    async def fake_generate_gap_narrative(gap_data, profile):
        narrative_calls["n"] += 1
        return "narrative"

    monkeypatch.setattr(gap_module, "load_gap_context", fake_load_gap_context)
    monkeypatch.setattr(
        gap_module,
        "compute_combined_skill_gap",
        lambda ctx: {"priority_learn": [], "market_missing_skills": [], "verified_weak_skills": []},
    )
    monkeypatch.setattr(gap_module, "generate_gap_narrative", fake_generate_gap_narrative)

    state = {
        "profile_id": str(profile_id),
        "profile": profile,
        "include_narrative": True,
        "run_roadmap": False,
    }
    result = asyncio.run(gap_module.gap_node(state))

    assert narrative_calls["n"] == 1
    assert result["narrative_summary"] == "narrative"


def test_roadmap_node_uses_cached_profile_and_overlaps_narrative(monkeypatch):
    profile_id = uuid.uuid4()
    profile = _FakeProfile(profile_id)
    factory = _fake_session_factory(profile)
    monkeypatch.setattr(roadmap_module, "async_session_factory", factory)

    order: list[str] = []

    async def fake_generate_gap_narrative(gap_data, profile):
        order.append("narrative:start")
        await asyncio.sleep(0.05)
        order.append("narrative:end")
        return "narrative"

    async def fake_build_user_roadmap_dict(profile, gap_data):
        order.append("roadmap:start")
        await asyncio.sleep(0.05)
        order.append("roadmap:end")
        return {"phases": []}, {"completed_nodes": []}, "summary"

    monkeypatch.setattr(roadmap_module, "generate_gap_narrative", fake_generate_gap_narrative)
    monkeypatch.setattr(roadmap_module, "build_user_roadmap_dict", fake_build_user_roadmap_dict)

    state = {
        "profile_id": str(profile_id),
        "profile": profile,
        "skill_gap": {},
        "include_narrative": True,
    }
    result = asyncio.run(roadmap_module.roadmap_node(state))

    assert factory.calls["db.get"] == 0, "roadmap_node must not re-fetch a profile already in state"
    assert result["narrative_summary"] == "narrative"
    assert result["roadmap"]["summary"] == "summary"
    # Both tasks must have started before either finished — proof they ran
    # concurrently via asyncio.gather rather than one after the other.
    assert order.index("narrative:start") < order.index("roadmap:end")
    assert order.index("roadmap:start") < order.index("narrative:end")


def test_roadmap_node_falls_back_to_db_when_profile_not_cached(monkeypatch):
    profile_id = uuid.uuid4()
    profile = _FakeProfile(profile_id)
    factory = _fake_session_factory(profile)
    monkeypatch.setattr(roadmap_module, "async_session_factory", factory)

    async def fake_build_user_roadmap_dict(profile, gap_data):
        return {"phases": []}, {"completed_nodes": []}, "summary"

    monkeypatch.setattr(roadmap_module, "build_user_roadmap_dict", fake_build_user_roadmap_dict)

    state = {"profile_id": str(profile_id), "skill_gap": {}, "include_narrative": False}
    result = asyncio.run(roadmap_module.roadmap_node(state))

    assert factory.calls["db.get"] == 1
    assert result["roadmap"]["summary"] == "summary"
