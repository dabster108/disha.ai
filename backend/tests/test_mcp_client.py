"""Unit tests for the MCP-discovered learning media layer.

MCP servers are never hit in tests — ``_tools_for`` is monkeypatched with
fake LangChain-shaped tools so we can exercise the discovery/parsing logic
(and its failure handling) without a network call.
"""

import asyncio
from types import SimpleNamespace

from app.services import mcp_client


class FakeTool:
    def __init__(self, name, args=None, result=None, raises=False):
        self.name = name
        self.args = args or {}
        self._result = result
        self._raises = raises

    async def ainvoke(self, args):
        if self._raises:
            raise RuntimeError("mcp tool boom")
        return self._result


def _settings(**overrides):
    base = dict(mcp_enabled=True, mcp_timeout_seconds=1.0)
    base.update(overrides)
    return SimpleNamespace(**base)


def _patch_tools_for(monkeypatch, tools_by_server: dict):
    async def fake(server_name):
        return tools_by_server.get(server_name, [])

    monkeypatch.setattr(mcp_client, "_tools_for", fake)


def test_search_learning_web_returns_empty_when_mcp_disabled(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings(mcp_enabled=False))
    result = asyncio.run(mcp_client.search_learning_web("python tutorial"))
    assert result == []


def test_search_learning_web_returns_empty_when_no_search_tool(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    _patch_tools_for(monkeypatch, {mcp_client._DUCKDUCKGO: [FakeTool("unrelated")]})
    result = asyncio.run(mcp_client.search_learning_web("python tutorial"))
    assert result == []


def test_search_learning_web_swallows_tool_errors(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    _patch_tools_for(monkeypatch, {mcp_client._DUCKDUCKGO: [FakeTool("web_search", {"query": {}}, raises=True)]})
    result = asyncio.run(mcp_client.search_learning_web("python tutorial"))
    assert result == []


def test_search_learning_web_parses_markdown_links(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    raw = (
        "1. [Python Tutorial](https://www.youtube.com/watch?v=abc123)\n"
        "2. [Another result](https://example.com/page)\n"
    )
    _patch_tools_for(
        monkeypatch,
        {mcp_client._DUCKDUCKGO: [FakeTool("web_search", {"query": {}}, result=raw)]},
    )
    result = asyncio.run(mcp_client.search_learning_web("python tutorial site:youtube.com"))
    assert {"title": "Python Tutorial", "url": "https://www.youtube.com/watch?v=abc123"} in result


def test_search_learning_web_parses_structured_results(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    raw = [{"title": "Python Tutorial", "url": "https://www.youtube.com/watch?v=abc123"}]
    _patch_tools_for(
        monkeypatch,
        {mcp_client._DUCKDUCKGO: [FakeTool("web_search", {"query": {}}, result=raw)]},
    )
    result = asyncio.run(mcp_client.search_learning_web("python tutorial"))
    assert result == raw


def test_fetch_library_docs_returns_none_when_mcp_disabled(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings(mcp_enabled=False))
    result = asyncio.run(mcp_client.fetch_library_docs("react"))
    assert result is None


def test_fetch_library_docs_returns_none_when_tools_missing(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    _patch_tools_for(monkeypatch, {mcp_client._CONTEXT7: []})
    result = asyncio.run(mcp_client.fetch_library_docs("react"))
    assert result is None


def test_fetch_library_docs_returns_none_when_docs_tool_raises(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    resolve_tool = FakeTool("resolve-library-id", {"libraryName": {}}, result="/facebook/react")
    docs_tool = FakeTool("get-library-docs", {"context7CompatibleLibraryID": {}, "topic": {}}, raises=True)
    _patch_tools_for(monkeypatch, {mcp_client._CONTEXT7: [resolve_tool, docs_tool]})
    result = asyncio.run(mcp_client.fetch_library_docs("react"))
    assert result is None


def test_fetch_library_docs_success_shapes_a_learning_resource(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    resolve_tool = FakeTool("resolve-library-id", {"libraryName": {}}, result="Best match: /facebook/react")
    docs_tool = FakeTool(
        "get-library-docs",
        {"context7CompatibleLibraryID": {}, "topic": {}},
        result="# React docs\nUse hooks for state.",
    )
    _patch_tools_for(monkeypatch, {mcp_client._CONTEXT7: [resolve_tool, docs_tool]})

    result = asyncio.run(mcp_client.fetch_library_docs("react", topic="hooks"))

    assert result is not None
    assert result["consume"] == "markdown"
    assert result["type"] == "docs"
    assert result["embed_url"] is None
    assert result["url"] == "https://context7.com/facebook/react"
    assert "hooks" in result["content_md"].casefold() or "React docs" in result["content_md"]


def test_fetch_library_docs_truncates_long_content(monkeypatch):
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    resolve_tool = FakeTool("resolve-library-id", {"libraryName": {}}, result="/some/lib")
    long_content = "x" * (mcp_client._CONTENT_MD_MAX_CHARS + 500)
    docs_tool = FakeTool(
        "get-library-docs", {"context7CompatibleLibraryID": {}}, result=long_content
    )
    _patch_tools_for(monkeypatch, {mcp_client._CONTEXT7: [resolve_tool, docs_tool]})

    result = asyncio.run(mcp_client.fetch_library_docs("some-lib"))

    assert result is not None
    assert len(result["content_md"]) <= mcp_client._CONTENT_MD_MAX_CHARS + 10
