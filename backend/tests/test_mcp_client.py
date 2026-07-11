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


def test_search_learning_web_parses_numbered_url_format(monkeypatch):
    # The exact format duckduckgo-mcp-server (uvx duckduckgo-mcp-server) returns.
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    raw = (
        "Found 2 search results:\n\n"
        "1. PHP Programming Language Tutorial - Full Course\n"
        "   URL: https://www.youtube.com/watch?v=OK_JCtrrv-c\n"
        "   Summary: Learn PHP in this full course.\n\n"
        "2. PHP Tutorials - YouTube\n"
        "   URL: https://www.youtube.com/playlist?list=abc\n"
        "   Summary: A playlist.\n"
    )
    _patch_tools_for(
        monkeypatch,
        {mcp_client._DUCKDUCKGO: [FakeTool("search", {"query": {}}, result=raw)]},
    )
    result = asyncio.run(mcp_client.search_learning_web("PHP tutorial site:youtube.com"))
    assert {
        "title": "PHP Programming Language Tutorial - Full Course",
        "url": "https://www.youtube.com/watch?v=OK_JCtrrv-c",
    } in result


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


def test_fetch_library_docs_matches_real_context7_arg_names(monkeypatch):
    # mcp.context7.com's actual tools: resolve-library-id needs libraryName +
    # query (both required); query-docs needs libraryId + query.
    monkeypatch.setattr(mcp_client, "get_settings", lambda: _settings())
    resolve_calls = []
    docs_calls = []

    class RecordingTool(FakeTool):
        def __init__(self, name, args, result, calls):
            super().__init__(name, args, result=result)
            self._calls = calls

        async def ainvoke(self, args):
            self._calls.append(args)
            return self._result

    resolve_tool = RecordingTool(
        "resolve-library-id",
        {"query": {}, "libraryName": {}},
        result=[{"type": "text", "text": "- Context7-compatible library ID: /python/cpython"}],
        calls=resolve_calls,
    )
    docs_tool = RecordingTool(
        "query-docs",
        {"libraryId": {}, "query": {}},
        result=[{"type": "text", "text": "### Hello\nSome docs content."}],
        calls=docs_calls,
    )
    _patch_tools_for(monkeypatch, {mcp_client._CONTEXT7: [resolve_tool, docs_tool]})

    result = asyncio.run(mcp_client.fetch_library_docs("python"))

    assert result is not None
    assert result["url"] == "https://context7.com/python/cpython"
    assert "Hello" in result["content_md"]
    # Both required args were actually sent, under the real field names.
    assert set(resolve_calls[0]) == {"query", "libraryName"}
    assert set(docs_calls[0]) == {"libraryId", "query"}


def test_extract_library_id_ignores_response_envelope_id():
    # Regression: langchain wraps tool text results as {"type","text","id"},
    # and that wrapper "id" (e.g. "lc_...") must never be mistaken for the
    # actual Context7 library ID embedded in the "text" field.
    raw = [
        {
            "type": "text",
            "text": "Available Libraries:\n\n- Context7-compatible library ID: /python/cpython\n",
            "id": "lc_93db7977-c0a2-486a-a19c-059ec1c9266b",
        }
    ]
    assert mcp_client._extract_library_id(raw) == "/python/cpython"


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
