"""MCP-discovered learning media for the Learning panel.

Wraps two MCP servers behind one small interface: a DuckDuckGo web-search
server (for finding real YouTube tutorials) and a Context7 docs server (for
real library documentation). Both are optional and off by default
(``settings.mcp_enabled``) — the Learning panel already works from the
curated catalog in ``app.services.learning_resources`` without either.

Every entry point here is defensive: disabled, unreachable, slow, or
schema-mismatched servers all resolve to an empty result rather than an
exception, so a flaky MCP server never breaks curriculum generation.
"""

from __future__ import annotations

import asyncio
import logging
import re
from functools import lru_cache
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient

from app.config import get_settings

logger = logging.getLogger(__name__)

_DUCKDUCKGO = "duckduckgo"
_CONTEXT7 = "context7"

# Context7 library IDs look like "/org/project" or "/org/project/version".
_LIBRARY_ID_RE = re.compile(r"/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?")

# Cheap heuristics for pulling {title, url} pairs out of a DuckDuckGo MCP
# tool's response, whose exact shape varies by server implementation.
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
# "1. Some Title\n   URL: https://..." — the format duckduckgo-mcp-server uses.
_NUMBERED_RESULT_RE = re.compile(r"^\s*\d+\.\s*(.+?)\s*\n\s*URL:\s*(\S+)", re.MULTILINE)
_BARE_URL_RE = re.compile(r"https?://[^\s)>\]]+")

_CONTENT_MD_MAX_CHARS = 10_000
_QUOTA_EXCEEDED_RE = re.compile(r"quota exceeded", re.IGNORECASE)
_CONTEXT7_CONCURRENCY = 3
_context7_semaphore: asyncio.Semaphore | None = None


def _get_context7_semaphore() -> asyncio.Semaphore:
    global _context7_semaphore
    if _context7_semaphore is None:
        _context7_semaphore = asyncio.Semaphore(_CONTEXT7_CONCURRENCY)
    return _context7_semaphore


def _connection_for(url: str | None, command: str | None, args: list[str] | None) -> dict[str, Any] | None:
    if url:
        return {"transport": "streamable_http", "url": url}
    if command:
        return {"transport": "stdio", "command": command, "args": list(args or [])}
    return None


@lru_cache
def _client() -> MultiServerMCPClient | None:
    settings = get_settings()
    connections: dict[str, Any] = {}

    ddg = _connection_for(
        settings.mcp_duckduckgo_url, settings.mcp_duckduckgo_command, settings.mcp_duckduckgo_args
    )
    if ddg:
        connections[_DUCKDUCKGO] = ddg

    ctx7 = _connection_for(
        settings.mcp_context7_url, settings.mcp_context7_command, settings.mcp_context7_args
    )
    if ctx7:
        if settings.mcp_context7_api_key:
            ctx7 = {**ctx7, "headers": {"CONTEXT7_API_KEY": settings.mcp_context7_api_key}}
        connections[_CONTEXT7] = ctx7

    if not connections:
        return None
    return MultiServerMCPClient(connections)


async def _tools_for(server_name: str) -> list:
    client = _client()
    if client is None or server_name not in client.connections:
        return []
    settings = get_settings()
    try:
        return await asyncio.wait_for(
            client.get_tools(server_name=server_name), timeout=settings.mcp_timeout_seconds
        )
    except Exception:
        logger.warning("mcp: failed to load tools from %r", server_name, exc_info=True)
        return []


def _find_tool(tools: list, *name_fragments: str):
    for candidate in tools:
        name = (getattr(candidate, "name", "") or "").casefold()
        if any(fragment in name for fragment in name_fragments):
            return candidate
    return None


def _match_arg_name(tool, *fragments: str) -> str | None:
    """Fuzzy-match a tool's declared argument names against semantic
    fragments (e.g. "library", "topic") — MCP servers name their fields
    differently, so we discover rather than hardcode a single casing."""
    try:
        schema_props = tool.args or {}
    except Exception:
        return None
    for name in schema_props:
        if any(fragment in name.casefold() for fragment in fragments):
            return name
    return None


async def _invoke(tool, args: dict) -> Any:
    settings = get_settings()
    try:
        return await asyncio.wait_for(tool.ainvoke(args), timeout=settings.mcp_timeout_seconds)
    except TimeoutError:
        raise
    except asyncio.CancelledError as exc:
        raise TimeoutError from exc


def _stringify(raw: Any) -> str:
    if isinstance(raw, str):
        return raw
    if isinstance(raw, (list, tuple)):
        return "\n".join(_stringify(item) for item in raw)
    if isinstance(raw, dict):
        for key in ("text", "content", "value"):
            if isinstance(raw.get(key), str):
                return raw[key]
        return str(raw)
    return str(raw) if raw is not None else ""


def _parse_search_results(raw: Any) -> list[dict]:
    """Best-effort {title, url} extraction from a DuckDuckGo MCP tool
    response — either structured (list of dicts) or free text."""
    results: list[dict] = []

    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            url = item.get("url") or item.get("link") or item.get("href")
            title = item.get("title") or item.get("name") or url
            if url:
                results.append({"title": title, "url": url})
        if results:
            return results

    text = _stringify(raw)
    for title, url in _MARKDOWN_LINK_RE.findall(text):
        results.append({"title": title.strip(), "url": url.strip()})
    if results:
        return results

    for title, url in _NUMBERED_RESULT_RE.findall(text):
        results.append({"title": title.strip(), "url": url.strip()})
    if results:
        return results

    for url in _BARE_URL_RE.findall(text):
        results.append({"title": url, "url": url.strip()})
    return results


async def search_learning_web(query: str) -> list[dict]:
    """DuckDuckGo web search via MCP. Returns [{"title", "url"}, ...], or []
    if MCP is disabled, unreachable, times out, or the server has no usable
    search tool."""
    settings = get_settings()
    if not settings.mcp_enabled:
        return []

    tools = await _tools_for(_DUCKDUCKGO)
    tool = _find_tool(tools, "search")
    if tool is None:
        return []

    query_arg = _match_arg_name(tool, "query", "q", "search") or "query"
    try:
        raw = await _invoke(tool, {query_arg: query})
    except Exception:
        logger.warning("mcp: duckduckgo search failed for %r", query, exc_info=True)
        return []

    return _parse_search_results(raw)


def _extract_library_id(raw: Any) -> str | None:
    # Only trust a dict field if its value actually looks like a library ID —
    # response envelopes (e.g. langchain's message wrapper) have their own
    # unrelated "id" field that would otherwise false-match here.
    if isinstance(raw, dict):
        for key in ("libraryId", "context7CompatibleLibraryID", "id"):
            value = raw.get(key)
            if isinstance(value, str) and _LIBRARY_ID_RE.fullmatch(value):
                return value
    if isinstance(raw, list):
        for item in raw:
            found = _extract_library_id(item)
            if found:
                return found
    match = _LIBRARY_ID_RE.search(_stringify(raw))
    return match.group(0) if match else None


async def fetch_library_docs(library: str, topic: str | None = None) -> dict | None:
    """Real Context7 docs for ``library`` (optionally scoped to ``topic``) as
    a Learning-panel resource dict, or None if MCP is disabled, unreachable,
    times out, or the library can't be resolved."""
    settings = get_settings()
    if not settings.mcp_enabled:
        return None

    tools = await _tools_for(_CONTEXT7)
    resolve_tool = _find_tool(tools, "resolve")
    docs_tool = _find_tool(tools, "docs")
    if resolve_tool is None or docs_tool is None:
        return None

    task_query = topic or f"learn {library}: getting started"

    library_arg = _match_arg_name(resolve_tool, "library", "name") or "libraryName"
    resolve_args = {library_arg: library}
    resolve_query_arg = _match_arg_name(resolve_tool, "query")
    if resolve_query_arg:
        resolve_args[resolve_query_arg] = task_query
    async with _get_context7_semaphore():
        try:
            resolved = await _invoke(resolve_tool, resolve_args)
        except TimeoutError:
            logger.warning("mcp: context7 resolve-library-id timed out for %r", library)
            return None
        except Exception:
            logger.warning("mcp: context7 resolve-library-id failed for %r", library, exc_info=True)
            return None

        library_id = _extract_library_id(resolved)
        if not library_id:
            return None

        docs_id_arg = _match_arg_name(docs_tool, "id", "library") or "context7CompatibleLibraryID"
        docs_args = {docs_id_arg: library_id}
        # Some Context7-compatible servers call this "topic", others "query" — either
        # way it's typically required, so always send something rather than only
        # when a caller-supplied topic exists.
        docs_query_arg = _match_arg_name(docs_tool, "topic", "query")
        if docs_query_arg:
            docs_args[docs_query_arg] = task_query

        try:
            raw_docs = await _invoke(docs_tool, docs_args)
        except TimeoutError:
            logger.warning("mcp: context7 get-library-docs timed out for %r", library_id)
            return None
        except Exception:
            logger.warning("mcp: context7 get-library-docs failed for %r", library_id, exc_info=True)
            return None

    content_md = _stringify(raw_docs).strip()
    if not content_md or _QUOTA_EXCEEDED_RE.search(content_md):
        if content_md and _QUOTA_EXCEEDED_RE.search(content_md):
            logger.warning("mcp: context7 quota exceeded for %r — set MCP_CONTEXT7_API_KEY", library)
        return None
    if len(content_md) > _CONTENT_MD_MAX_CHARS:
        content_md = content_md[:_CONTENT_MD_MAX_CHARS].rstrip() + "\n\n…"

    return {
        "title": f"{library} — Context7 Docs" + (f" ({topic})" if topic else ""),
        "url": f"https://context7.com{library_id}",
        "provider": "Context7",
        "type": "docs",
        "cost": "free",
        "duration": None,
        "embed_url": None,
        "consume": "markdown",
        "content_md": content_md,
    }
