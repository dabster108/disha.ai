# Scrape + ingest IT-focused Nepal jobs into Chroma (Windows PowerShell)
# Usage: .\scripts\refresh_jobs.ps1 [max-per-source]
# Default: 100 per source, all portals except Jobaxle, tech-focus ON.
param([int]$MaxPerSource = 100)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:CRAWL4AI_BASE_DIRECTORY = "./.crawl4ai"

Write-Host "Scraping IT/software jobs (max $MaxPerSource per source, no Jobaxle)..."
uv run python -m scraper.run `
  --tech-focus `
  --source kamkhoj `
  --source merojob `
  --source kumarijob `
  --source jobsnepal `
  --source jobejee `
  --source merorojgari `
  --max-per-source $MaxPerSource `
  --log-db `
  --log-file

Write-Host "Merging curated IT seed jobs..."
uv run python -m scripts.seed_jobs --merge-it

Write-Host "Ingesting into Chroma..."
uv run python -m app.rag.ingest --reset

uv run python -c @"
import json
from app.config import get_settings
import chromadb
s = get_settings()
jobs = json.load(open('data/jobs.json', encoding='utf-8'))['jobs']
c = chromadb.PersistentClient(path=str(s.chroma_path)).get_collection(s.chroma_collection)
print(f'Done — jobs.json={len(jobs)} chroma={c.count()}')
"@
