#!/usr/bin/env bash
# Scrape (kamkhoj aggregator mode), then re-embed into Chroma.
# Usage: scripts/refresh_jobs.sh [max-per-source]   (default 100)
set -euo pipefail
cd "$(dirname "$0")/.."
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai
uv run python -m scraper.run --mode aggregator --max-per-source "${1:-100}" --log-db --log-file
uv run python -m app.rag.ingest --reset
uv run python -c "import json; print('Done —', len(json.load(open('data/jobs.json'))['jobs']), 'jobs in Chroma')"
