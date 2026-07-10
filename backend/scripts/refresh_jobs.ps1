# Scrape + ingest jobs into Chroma (Windows PowerShell)
# Usage: .\scripts\refresh_jobs.ps1 [max-per-source]
param([int]$MaxPerSource = 100)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:CRAWL4AI_BASE_DIRECTORY = "./.crawl4ai"

Write-Host "Scraping Nepal job boards (max $MaxPerSource per source)..."
uv run python -m scraper.run --mode hybrid --max-per-source $MaxPerSource --log-db --log-file

Write-Host "Ingesting into Chroma..."
uv run python -m app.rag.ingest --reset

uv run python -c "import json; print('Done -', len(json.load(open('data/jobs.json'))['jobs']), 'jobs in Chroma')"
