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


def test_build_resources_for_skill_still_works_for_roadmap():
    # Unaffected by the Learning-panel changes — used by attach_resources_to_weeks.
    resources = lr.build_resources_for_skill("python")
    assert resources
    assert any(r["consume"] == "embed" for r in resources)
    # Search deep-links are still present for the roadmap queue (opened in a new tab there).
    assert any(r["consume"] is None for r in resources)


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
