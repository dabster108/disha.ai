#!/usr/bin/env bash
# One-command refresh: hybrid scrape (kamkhoj + merojob + kumarijob, deduped)
# then re-embed everything into Chroma. Prints per-source stats and verifies
# the Chroma vector count matches jobs.json.
# Usage: scripts/refresh_jobs.sh [max-per-source]   (default 150)
set -euo pipefail
cd "$(dirname "$0")/.."
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai

uv run python -m scraper.run --mode hybrid --max-per-source "${1:-150}" --log-db --log-file
uv run python -m app.rag.ingest --reset

uv run python -c "
import json
from app.config import get_settings
import chromadb

settings = get_settings()
jobs = json.load(open('data/jobs.json'))['jobs']
client = chromadb.PersistentClient(path=settings.chroma_path)
collection = client.get_collection(settings.chroma_collection)
chroma_count = collection.count()

print(f'jobs.json: {len(jobs)} jobs')
print(f'Chroma:    {chroma_count} vectors')
status = 'OK' if chroma_count == len(jobs) else 'MISMATCH'
print(f'Status:    {status}')
if status != 'OK':
    raise SystemExit(1)
"
