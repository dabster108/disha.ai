# DISHA AI — Developer Setup

Step-by-step guide for cloning the repo and running the backend locally. Share API keys and `DATABASE_URL` **privately** — never commit them.

---

## Prerequisites

Install these first:

| Tool | Version | Notes |
|------|---------|--------|
| **Python** | 3.14+ | Required for the backend |
| **uv** | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **Node.js** | 20+ | Only if you want the frontend |
| **Neon Postgres** | — | Your own project, or a shared `DATABASE_URL` (private) |

**API keys**

| Key | Required? | Used for |
|-----|-----------|----------|
| `GROQ_API_KEY` | **Yes** | Skills extraction, practice, gap narrative, roadmaps |
| `DATABASE_URL` | **Yes** | Neon Postgres (profiles, interviews, snapshots, roadmaps) |
| `MISTRAL_API_KEY` | For CV upload | PDF resume OCR |
| `MISTRAL_API_KEY2` | Recommended | Interview Q&A (separate quota from OCR) |
| `ADMIN_API_KEY` | Optional | `POST /api/admin/scrape` |
| Google service account JSON | Optional | Voice TTS/STT (`GOOGLE_APPLICATION_CREDENTIALS`) |

---

## One-time setup

```bash
git clone <your-repo-url>
cd disha.ai/backend
```

### 1. Create `.env`

```bash
cp .env.example .env
```

Edit `backend/.env`. **Minimum:**

```env
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require
```

Add `MISTRAL_API_KEY` if using resume upload, `MISTRAL_API_KEY2` for interviews, etc. See [backend/.env.example](backend/.env.example) for all variables.

### 2. Install dependencies

```bash
uv sync
uv run playwright install chromium
```

First `uv sync` creates `.venv` and installs everything (Chroma, Crawl4AI, LangGraph). The first RAG run also downloads the BGE embedding model (~100 MB).

### 3. Run database migrations

```bash
uv run alembic upgrade head
```

Creates tables: `student_profiles`, interview/practice sessions, `scrape_runs`, `skill_gap_snapshots`, `roadmaps`, etc.

### 4. Smoke test Groq (optional)

```bash
uv run python test_groq.py
```

Should print a short LLM response. If it fails, check `GROQ_API_KEY`.

### 5. Scrape jobs and build Chroma (**required**)

`data/` is gitignored — you will **not** get `jobs.json` or Chroma from git. Scrape locally:

```bash
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai   # omit on Windows; set in shell or use refresh script
uv run python -m scraper.run --mode hybrid --max-per-source 100 --log-db --log-file
uv run python -m app.rag.ingest --reset
```

**Shortcut (Linux/macOS):**

```bash
chmod +x scripts/refresh_jobs.sh
./scripts/refresh_jobs.sh 100
```

On Windows (PowerShell), run the two `uv run` commands above manually, or:

```powershell
$env:CRAWL4AI_BASE_DIRECTORY = "./.crawl4ai"
uv run python -m scraper.run --mode aggregator --max-per-source 100 --log-db --log-file
uv run python -m app.rag.ingest --reset
```

Scraping can take several minutes. Without this step, interview/practice skill suggestions and gap logic have **no job data**.

### 6. Start the API

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://127.0.0.1:8000/docs  
- Health checks:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/db
```

---

## Daily workflow (after setup)

**Terminal 1 — API:**

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — refresh jobs (optional, weekly):**

```bash
cd backend
./scripts/refresh_jobs.sh 100
```

---

## Quick test flow (Swagger `/docs`)

1. `POST /api/profile/upload-resume` — upload a PDF CV (needs `MISTRAL_API_KEY`)
2. `POST /api/profile` — save profile with returned skills
3. `POST /api/interview/start` — `{ "profile_id": "<uuid>" }`
4. `POST /api/interview/answer` — answer until complete
5. `POST /api/practice/skills/suggest` — `{ "profile_id": "<uuid>" }`
6. `POST /api/practice/start` — pick 1–3 skills
7. `POST /api/gap` — combined skill gap report
8. `POST /api/roadmap` — week-by-week plan from latest gap snapshot

---

## Frontend (optional)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

The UI is a Next.js dashboard (landing page + student workspace). Most API testing is still easiest via `/docs` until frontend is wired to the backend.

---

## Common issues

| Problem | Fix |
|---------|-----|
| `GROQ_API_KEY` / `DATABASE_URL` missing | Add them to `backend/.env` |
| `health/db` fails | Neon URL must use `postgresql+asyncpg://...` (not plain `postgresql://`) |
| RAG returns nothing | Run scrape + `uv run python -m app.rag.ingest --reset` |
| CV upload fails | Set `MISTRAL_API_KEY` |
| Voice endpoints fail | Set `GOOGLE_APPLICATION_CREDENTIALS` or skip voice |
| Playwright errors on scrape | `uv run playwright install chromium` again |
| Scrape is slow | Normal — KamKhoj + enrichment can take several minutes |

---

## What to share privately (not in git)

- Full `backend/.env` contents, or each key separately
- Neon `DATABASE_URL` (if using a shared database)
- Google service account JSON (if voice is needed)

**Do not push** `.env` or `data/` — both are gitignored.

---

## Short version (copy-paste for a teammate)

```bash
cd backend
cp .env.example .env
# Edit .env: GROQ_API_KEY + DATABASE_URL (+ MISTRAL keys if using CV/interview)

uv sync
uv run playwright install chromium
uv run alembic upgrade head
./scripts/refresh_jobs.sh 100    # or manual scrape + ingest on Windows
uv run uvicorn app.main:app --reload --port 8000
```

More detail: [backend/README.md](backend/README.md) (API reference, scrape modes, architecture).
