from __future__ import annotations

import json
import os
from pathlib import Path

from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig

CRAWL4AI_BASE = Path(__file__).resolve().parents[1] / ".crawl4ai"
os.environ.setdefault("CRAWL4AI_BASE_DIRECTORY", str(CRAWL4AI_BASE))

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


async def fetch_html(
    url: str,
    *,
    wait_seconds: float = 2.0,
    js_code: str | None = None,
) -> str:
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=120_000,
        delay_before_return_html=wait_seconds,
        js_code=js_code,
    )
    async with AsyncWebCrawler(verbose=False) as crawler:
        result = await crawler.arun(url=url, config=config)
        if not result.success:
            raise RuntimeError(f"Failed to crawl {url}: {result.error_message}")
        return result.html or ""


async def fetch_json(url: str) -> dict | list:
    html = await fetch_html(url, wait_seconds=0.5)
    return json.loads(html)
