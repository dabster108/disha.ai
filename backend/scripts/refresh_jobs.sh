#!/usr/bin/env bash
# One-command refresh: IT-focused scrape across Nepal portals (no Jobaxle by
# default when using --source list below), then re-embed into Chroma.
# Usage: scripts/refresh_jobs.sh [max-per-source]   (default 100)
set -euo pipefail
cd "$(dirname "$0")/.."
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai

MAX="${1:-100}"

uv run python -m scraper.run \
  --tech-focus \
  --source kamkhoj \
  --source merojob \
  --source kumarijob \
  --source jobsnepal \
  --source jobejee \
  --source merorojgari \
  --max-per-source "$MAX" \
  --log-db \
  --log-file

# Densify with curated Nepal IT postings (live portals have few tech roles).
uv run python -m scripts.seed_jobs --merge-it

uv run python -m app.rag.ingest --reset

uv run python -c "
import json
from collections import Counter
from app.config import get_settings
from app.rag.documents import infer_role_category
from scraper.tech_focus import IT_ROLE_CATEGORIES, is_it_sector_job
from scraper.models import JobsFile
import chromadb

settings = get_settings()
jf = JobsFile.model_validate(json.loads(open(settings.jobs_file).read()))
jobs = jf.jobs
client = chromadb.PersistentClient(path=settings.chroma_path)
collection = client.get_collection(settings.chroma_collection)
chroma_count = collection.count()

tech = sum(1 for j in jobs if is_it_sector_job(j))
cats = Counter(infer_role_category(j.title, j.required_skills or []) for j in jobs)

print(f'jobs.json: {len(jobs)} jobs ({tech} IT-classified)')
print(f'Chroma:    {chroma_count} vectors')
print('top categories:', cats.most_common(8))
status = 'OK' if chroma_count == len(jobs) else 'MISMATCH'
print(f'Status:    {status}')
if status != 'OK':
    raise SystemExit(1)
"
