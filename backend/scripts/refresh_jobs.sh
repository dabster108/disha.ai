#!/usr/bin/env bash
# Scrape all Nepal job portals, then re-embed into Chroma.
# Usage: scripts/refresh_jobs.sh [max-per-source]   (default 50)
set -euo pipefail
cd "$(dirname "$0")/.."
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai
.venv/bin/python -m scraper.run --max-per-source "${1:-50}"
.venv/bin/python -m app.rag.ingest --reset
.venv/bin/python -c "import json; print('Done —', len(json.load(open('data/jobs.json'))['jobs']), 'jobs in Chroma')"
