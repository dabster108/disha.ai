# Disha AI — Backend

Agentic career platform for Nepali students. See [project.md](project.md) for the full architecture.

```
app/
  main.py              # FastAPI — uv run uvicorn app.main:app --reload
  api/routes/          # health, profile, gap, roadmap, admin (scrape trigger)
  db/                  # Neon Postgres (profiles, scrape_runs)
  rag/                 # jobs.json → Chroma ingest + search_jobs
  services/            # cv_parser (Mistral OCR + Groq), skill_gap
  orchestrator/        # LangGraph skeleton
scraper/
  scraper.py           # ALL adapters + kamkhoj aggregator (see KAMKHOJ_PROBE.md)
  run.py               # CLI + execute_scrape_run (used by admin API too)
  logging_config.py    # console + data/logs/ file logging
scripts/refresh_jobs.sh
data/                  # jobs.json, chroma/, logs/ (gitignored)
```

## Job sources

| Source | Strategy | Role |
|---|---|---|
| **kamkhoj** | SSR page 1 + Crawl4AI pagination + detail canonical URL | **PRIMARY aggregator** (~1,700 jobs) |
| merojob | public JSON API | hybrid enrichment (real skill tags) |
| kumarijob | Crawl4AI + SSR cards | hybrid enrichment |
| jobaxle | sitemap → JSON-LD | direct mode |
| jobsnepal | Laravel SSR | direct mode |
| jobejee | SSR + JSON-LD | direct mode |
| merorojgari | WordPress REST API | direct mode |

Probe write-up: [scraper/KAMKHOJ_PROBE.md](scraper/KAMKHOJ_PROBE.md). **Decision: hybrid-primary** — default `--mode aggregator` uses KamKhoj only; `--mode hybrid` adds merojob + kumarijob for skill enrichment (deduped by original URL).

No LinkedIn scraping (ToS).

## Setup (one-time)

```bash
cd backend
uv sync
uv run playwright install chromium
uv run alembic upgrade head
uv run python test_groq.py
```

Copy `.env.example` → `.env` and fill in:

- `GROQ_API_KEY` — LLM (skills, roadmaps)
- `DATABASE_URL` — Neon Postgres
- `MISTRAL_API_KEY` — PDF resume OCR
- `ADMIN_API_KEY` — protects `POST /api/admin/scrape`

## Daily workflow

**Terminal 1 — API:**
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
# Docs: http://127.0.0.1:8000/docs
```

**Terminal 2 — scrape (aggregator default):**
```bash
cd backend
CRAWL4AI_BASE_DIRECTORY=./.crawl4ai uv run python -m scraper.run --mode aggregator --max-per-source 100 --log-db --log-file
```

**Terminal 3 — Chroma re-ingest after scrape:**
```bash
cd backend
uv run python -m app.rag.ingest --reset
```

**Or all-in-one:**
```bash
./scripts/refresh_jobs.sh 100
```

### Scrape modes

| Mode | Sources | When to use |
|---|---|---|
| `aggregator` (default) | kamkhoj only | Daily refresh — one site, ~1,700 jobs |
| `hybrid` | kamkhoj + merojob + kumarijob | Best skills coverage (deduped) |
| `direct` | 6 portal scrapers (no kamkhoj) | Fallback if KamKhoj breaks |

```bash
uv run python -m scraper.run --mode hybrid --max-per-source 50 --log-db
uv run python -m scraper.run --source kamkhoj --max-per-source 10   # single source
```

## Admin scrape API

Requires header `X-Admin-Key: <ADMIN_API_KEY>`.

| Endpoint | Description |
|---|---|
| `POST /api/admin/scrape` | Start background scrape (+ optional Chroma re-ingest) |
| `GET /api/admin/scrape/{id}` | Run status + per-source stats |
| `GET /api/admin/scrape/runs` | Recent runs |
| `GET /api/admin/scrape/sources/ranking` | Latest completeness ranking by source |

```bash
curl -X POST http://127.0.0.1:8000/api/admin/scrape \
  -H "X-Admin-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"aggregator","max_per_source":50,"reingest_chroma":true}'
```

## Profile / CV endpoints

| Endpoint | What it does |
|---|---|
| `GET /health`, `GET /health/db` | liveness + Postgres |
| `POST /api/profile` | save skills, target role, location |
| `GET /api/profile/{student_id}` | fetch profile |
| `POST /api/profile/upload-resume` | Mistral OCR 3 → Groq skills (review before save) |
| `POST /api/gap`, `POST /api/roadmap` | 501 — next phase |

## Architecture

- **Chroma** = job market vectors only (`search_jobs` for skill gap)
- **Postgres** = student profiles + `scrape_runs` telemetry
- **jobs.json** = human-readable scrape output; ingest into Chroma after each run
- Logs: `data/logs/scrape-{timestamp}.log` when using `--log-file`
