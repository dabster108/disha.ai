"""Unit tests for the Learning-panel resource layer: YouTube embed parsing,
resource normalization, and the MCP on/off/failure priority chain.
"""

import asyncio
from types import SimpleNamespace

from app.services import learning_resources as lr


def test_youtube_video_id_watch_url():
    assert lr.youtube_video_id("https://www.youtube.com/watch?v=rfscVS0vtbw") == "rfscVS0vtbw"


def test_youtube_video_id_watch_url_with_extra_params():
    assert lr.youtube_video_id("https://www.youtube.com/watch?list=abc&v=rfscVS0vtbw&t=10") == "rfscVS0vtbw"


def test_youtube_video_id_short_url():
    assert lr.youtube_video_id("https://youtu.be/rfscVS0vtbw?t=30") == "rfscVS0vtbw"


def test_youtube_video_id_embed_url():
    assert lr.youtube_video_id("https://www.youtube.com/embed/rfscVS0vtbw") == "rfscVS0vtbw"


def test_youtube_video_id_none_for_non_youtube_or_empty():
    assert lr.youtube_video_id("https://docs.python.org/3/tutorial/") is None
    assert lr.youtube_video_id(None) is None
    assert lr.youtube_video_id("") is None


def test_youtube_embed_url_format():
    assert lr.youtube_embed_url("abc123") == "https://www.youtube.com/embed/abc123"


def test_is_youtube_url_rejects_search_results_page():
    # A YouTube *search results* page is not a playable video — must not be
    # treated as embeddable.
    assert lr.is_youtube_url("https://www.youtube.com/results?search_query=python") is False


def test_normalize_resource_sets_embed_for_youtube_video():
    resource = {
        "title": "x", "url": "https://www.youtube.com/watch?v=abc123",
        "provider": "p", "type": "video", "cost": "free", "duration": None,
    }
    normalized = lr.normalize_resource(resource)
    assert normalized["consume"] == "embed"
    assert normalized["embed_url"] == "https://www.youtube.com/embed/abc123"
    assert normalized["content_md"] is None


def test_normalize_resource_leaves_non_video_unconsumable():
    resource = {
        "title": "x", "url": "https://docs.python.org/3/tutorial/",
        "provider": "p", "type": "docs", "cost": "free", "duration": None,
    }
    normalized = lr.normalize_resource(resource)
    assert normalized["consume"] is None
    assert normalized["embed_url"] is None


def test_normalize_resource_does_not_override_explicit_consume():
    resource = {
        "title": "x", "url": "https://context7.com/facebook/react", "type": "docs",
        "consume": "markdown", "content_md": "hello", "embed_url": None,
    }
    normalized = lr.normalize_resource(resource)
    assert normalized["consume"] == "markdown"
    assert normalized["content_md"] == "hello"


_ALREADY_GOOD_RESOURCE = {"title": "x", "url": "y", "consume": "embed"}
# Stale data from before the in-app-only contract — a non-empty list whose
# entries are all external deep-links (consume=None), which must not be
# mistaken for "already fine" and left in place.
_STALE_RESOURCE = {"title": "x — video tutorials", "url": "https://www.youtube.com/results?search_query=x", "consume": None}


def test_attach_resources_to_path_fills_empty_node_resources(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    path = {
        "phases": [
            {
                "id": "p1",
                "title": "Foundations",
                "nodes": [
                    {"id": "n1", "skill": "python", "title": "Python", "resources": []},
                    {"id": "n2", "skill": "python", "title": "Python", "resources": [_ALREADY_GOOD_RESOURCE]},
                ],
            }
        ]
    }
    changed = asyncio.run(lr.attach_resources_to_path(path))
    assert changed is True
    # Empty node gets backfilled with the curated catalog video — never a
    # dead-end external link, per the in-app-only contract.
    resources = path["phases"][0]["nodes"][0]["resources"]
    assert resources
    assert all(r["consume"] in ("embed", "markdown") for r in resources)
    # Already-consumable node is left untouched (idempotent).
    assert path["phases"][0]["nodes"][1]["resources"] == [_ALREADY_GOOD_RESOURCE]


def test_attach_resources_to_path_is_idempotent_when_nothing_missing():
    path = {"phases": [{"nodes": [{"skill": "python", "resources": [_ALREADY_GOOD_RESOURCE]}]}]}
    assert asyncio.run(lr.attach_resources_to_path(path)) is False


def test_attach_resources_to_path_regenerates_stale_external_only_resources(monkeypatch):
    # A non-empty list is not enough to skip regeneration — if every entry is
    # a non-in-app deep-link (pre-dating this feature), it must be replaced.
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    path = {"phases": [{"nodes": [{"skill": "python", "resources": [_STALE_RESOURCE]}]}]}
    changed = asyncio.run(lr.attach_resources_to_path(path))
    assert changed is True
    resources = path["phases"][0]["nodes"][0]["resources"]
    assert resources
    assert all(r["consume"] in ("embed", "markdown") for r in resources)


def test_attach_resources_to_path_regenerates_mixed_stale_and_good_resources(monkeypatch):
    # Regression: a real bug found live — the curated catalog video sits
    # alongside a stale search-page entry from before this feature existed.
    # Any non-consumable entry must trigger a full regeneration, not just a
    # fully-stale list, since the UI might pick any entry to show.
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    path = {"phases": [{"nodes": [{"skill": "python", "resources": [_STALE_RESOURCE, _ALREADY_GOOD_RESOURCE]}]}]}
    changed = asyncio.run(lr.attach_resources_to_path(path))
    assert changed is True
    resources = path["phases"][0]["nodes"][0]["resources"]
    assert resources
    assert all(r["consume"] in ("embed", "markdown") for r in resources)


def test_attach_resources_to_path_handles_none_and_empty():
    assert asyncio.run(lr.attach_resources_to_path(None)) is False
    assert asyncio.run(lr.attach_resources_to_path({})) is False


def test_attach_resources_to_path_leaves_unknown_skill_empty_not_external(monkeypatch):
    # No catalog match and MCP disabled — must not fall back to an external
    # search-page link; empty is the correct result. Explicitly forced off
    # here rather than relying on ambient env config (a real deployment may
    # have MCP_ENABLED=true).
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    path = {"phases": [{"nodes": [{"skill": "some-skill-not-in-catalog", "resources": []}]}]}
    asyncio.run(lr.attach_resources_to_path(path))
    assert path["phases"][0]["nodes"][0]["resources"] == []


def test_attach_resources_to_weeks_fills_empty_task_resources(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    weeks = [
        {
            "week": 1,
            "theme": "Foundations",
            "tasks": [
                {"skill": "python", "title": "Learn Python", "resources": []},
                {"skill": "python", "title": "Already done", "resources": [_ALREADY_GOOD_RESOURCE]},
            ],
        }
    ]
    changed = asyncio.run(lr.attach_resources_to_weeks(weeks))
    assert changed is True
    resources = weeks[0]["tasks"][0]["resources"]
    assert resources
    assert all(r["consume"] in ("embed", "markdown") for r in resources)
    assert weeks[0]["tasks"][1]["resources"] == [_ALREADY_GOOD_RESOURCE]


def test_attach_resources_to_weeks_is_idempotent_when_nothing_missing():
    weeks = [{"week": 1, "tasks": [{"skill": "python", "resources": [_ALREADY_GOOD_RESOURCE]}]}]
    assert asyncio.run(lr.attach_resources_to_weeks(weeks)) is False


def test_attach_resources_to_weeks_regenerates_stale_external_only_resources(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    weeks = [{"week": 1, "tasks": [{"skill": "python", "resources": [_STALE_RESOURCE]}]}]
    changed = asyncio.run(lr.attach_resources_to_weeks(weeks))
    assert changed is True
    resources = weeks[0]["tasks"][0]["resources"]
    assert resources
    assert all(r["consume"] in ("embed", "markdown") for r in resources)


def test_async_build_resources_mcp_disabled_returns_only_catalog_youtube(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    result = asyncio.run(lr.async_build_resources_for_skill("python"))
    assert result
    assert all(r["consume"] == "embed" for r in result)
    assert all(r["type"] == "video" for r in result)


def test_async_build_resources_unknown_skill_and_mcp_disabled_is_empty(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=False))
    result = asyncio.run(lr.async_build_resources_for_skill("some-skill-not-in-catalog"))
    assert result == []


def test_async_build_resources_mcp_enabled_adds_docs_and_searched_video(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=True))

    async def fake_docs(skill, topic=None):
        return {
            "title": "Rust Docs", "url": "https://context7.com/rust-lang/rust",
            "provider": "Context7", "type": "docs", "cost": "free", "duration": None,
            "embed_url": None, "consume": "markdown", "content_md": "# Hello Rust",
        }

    async def fake_search(query):
        return [{"title": "Rust tutorial", "url": "https://www.youtube.com/watch?v=zzz999"}]

    monkeypatch.setattr(lr, "fetch_library_docs", fake_docs)
    monkeypatch.setattr(lr, "search_learning_web", fake_search)

    result = asyncio.run(lr.async_build_resources_for_skill("rust", limit=5))

    types = {r["type"] for r in result}
    assert "docs" in types
    assert "video" in types
    assert {r["consume"] for r in result} <= {"embed", "markdown"}


def test_async_build_resources_skips_search_when_catalog_video_exists(monkeypatch):
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=True))
    calls = {"search": 0}

    async def fake_docs(skill, topic=None):
        return None

    async def fake_search(query):
        calls["search"] += 1
        return []

    monkeypatch.setattr(lr, "fetch_library_docs", fake_docs)
    monkeypatch.setattr(lr, "search_learning_web", fake_search)

    # "python" already has a catalog YouTube video — no need to search the web for one.
    asyncio.run(lr.async_build_resources_for_skill("python"))
    assert calls["search"] == 0


def test_async_build_resources_mcp_failure_falls_back_to_catalog(monkeypatch):
    # mcp_client.search_learning_web/fetch_library_docs never raise — a failed
    # server call surfaces as [] / None (see test_mcp_client.py). Confirm the
    # Learning-panel builder still returns the curated catalog video in that
    # case, so a flaky/unreachable MCP server can't break POST /api/learning/generate.
    monkeypatch.setattr(lr, "get_settings", lambda: SimpleNamespace(mcp_enabled=True))

    async def failed_docs(skill, topic=None):
        return None

    async def failed_search(query):
        return []

    monkeypatch.setattr(lr, "fetch_library_docs", failed_docs)
    monkeypatch.setattr(lr, "search_learning_web", failed_search)

    result = asyncio.run(lr.async_build_resources_for_skill("python"))

    assert result
    assert all(r["type"] == "video" and r["consume"] == "embed" for r in result)
