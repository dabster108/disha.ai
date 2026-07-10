# Disha AI — Backend

Agentic career platform for Nepali students. See [project.md](project.md) for the full architecture. One FastAPI server, with each concern in its own package:

```
app/
  main.py           # FastAPI entry — uvicorn app.main:app
  config.py         # settings from .env (GROQ_API_KEY, DATABASE_URL, MISTRAL_API_KEY, Chroma paths)
  api/routes/       # one file per endpoint group (health, profile, gap, roadmap)
  db/               # SQLAlchemy async models + Neon session
  rag/              # jobs.json -> Chroma ingest + search_jobs retriever
  services/         # cv_parser (Mistral OCR + Groq skills), skill_gap
  orchestrator/     # LangGraph: intake -> gap -> roadmap (roadmap stub for now)
scraper/
  scraper.py        # ALL site adapters + SOURCES registry (one file)
  models.py         # canonical JobPosting schema — RAG imports from here
  normalize.py      # salary/skill helpers
  crawl.py          # shared Crawl4AI fetch helper
  run.py            # thin CLI
migrations/         # Alembic (async, Neon Postgres)
scripts/            # refresh_jobs.sh (scrape + re-ingest in one go)
data/               # jobs.json + chroma/ (gitignored)
```

## Job sources

| Source | Strategy | Notes |
|---|---|---|
| merojob | public JSON API | best data quality |
| kumarijob | Crawl4AI + SSR cards | |
| jobaxle | sitemap → JSON-LD (Crawl4AI) | |
| jobsnepal | Laravel SSR listing + detail table (httpx) | |
| jobejee | SSR links + JSON-LD (httpx) | |
| merorojgari | WordPress REST API (httpx) | govt/NGO notices, thin fields |

slicejob was probed and dropped: its job pages ship no app JS and never render content. **No LinkedIn scraping (ToS).**

## Setup (one-time / occasional)

```bash
cd backend
uv sync
.venv/bin/playwright install chromium   # scraper browser
.venv/bin/alembic upgrade head          # Neon Postgres migrations
.venv/bin/python test_groq.py           # sanity-check Groq
```

Secrets live in `.env` (never committed): `GROQ_API_KEY`, `DATABASE_URL` (Neon), `MISTRAL_API_KEY` (OCR).

## Daily workflow — 3 terminals

**Terminal 1 — FastAPI (the only long-running server):**
```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Docs: http://127.0.0.1:8000/docs
```

**Terminal 2 — scrape the job market (manual or scheduled):**
```bash
cd backend
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai
.venv/bin/python -m scraper.run --max-per-source 50
# Full scrape (slow): --max-per-source 0
# One source:         --source merojob --max-per-source 100
# Log run to Postgres: --log-db
```

**Terminal 3 — re-ingest into Chroma after every scrape:**
```bash
cd backend
.venv/bin/python -m app.rag.ingest --reset
```

Or do 2+3 in one shot: `scripts/refresh_jobs.sh [max-per-source]`

There is no separate "crawl server" — Crawl4AI runs inside the scraper CLI via Playwright.

## Endpoints (current phase)

| Endpoint | What it does |
|---|---|
| `GET /health`, `GET /health/db` | liveness + Postgres check |
| `POST /api/profile` | save skills, target role, location, time/budget |
| `GET /api/profile/{student_id}` | fetch a profile |
| `POST /api/profile/upload-resume` | PDF → **Mistral OCR 3** (`mistral-ocr-2512`, pypdf fallback), DOCX → python-docx, then **Groq** structures the skills → returned for review (not auto-saved) |
| `POST /api/gap`, `POST /api/roadmap` | 501 — land in the next phase |

CV path: **Upload → Mistral OCR 3 → Groq skill parse → review → save via `POST /api/profile`.**

## Architecture rules

- All LLM calls use Groq (`llama-3.1-8b-instant`) via `langchain-groq`; CV text extraction uses Mistral OCR 3 — both configured in `app/config.py`.
- `scraper/models.py` is the canonical `JobPosting` schema; RAG ingest imports it — don't duplicate it.
- Chroma stores job-market data only; Postgres stores student state only.
- After each scrape, `run.py` prints a per-source completeness table (jobs, skills %, salary %, location %) — with `--log-db` it's saved to `scrape_runs`.
