<p align="center">
  <img src="frontend/components/images/logo.png" alt="DISHA AI Logo" width="180" />
</p>

<h1 align="center">DISHA AI</h1>

<p align="center">
  <em>Navigate your direction. Nepal job market. Build your future.</em>
</p>

<p align="center">
  Next.js 16 · FastAPI · LangGraph · Chroma · Neon Postgres
</p>

<p align="center">
  Agentic RAG + LangGraph — from CV to job-ready on Nepal market data
</p>

---

## What is DISHA AI

DISHA AI is a career-navigation platform for Nepali students and fresh graduates. It takes a
student from CV to job-ready, grounded in **real, live Nepal job market data** rather than
generic global career advice:

```
CV upload → canonical skills catalog → voice mock interview → skill practice game
   → skill gap vs. live Nepal jobs (RAG) → LangGraph orchestrator → personalized roadmap
   → explainable job matches → leaderboard → admin human verification
```

Every claim the platform makes about a student is backed by evidence: skills come from a
fixed catalog (not free text), the skill gap report cites real job counts from scraped
postings, and an interview or practice session must actually happen before a skill is called
"verified."

## Architecture

<p align="center">
  <img src="frontend/components/images/architecture.jpg" alt="DISHA AI Architecture" width="900" />
</p>

Reading the diagram top to bottom, mapped to what's actually in this repo:

**Clients** — the Next.js 16 student app (`frontend/app/(platform)/*`) and a separate
key-gated admin panel (`frontend/app/admin/*`), both calling the same FastAPI backend.

**API layer** — one FastAPI app, one router per domain (`backend/app/api/routes/`):
`profile`, `gap`, `jobs`, `interview`, `practice`, `roadmap`, `skills`, `voice`, `leaderboard`,
`dashboard`, `admin`, plus `health`. See [API map](#api-map) below.

**Orchestrator (LangGraph)** — `backend/app/orchestrator/` wires the career pipeline as a
real, compiled `StateGraph`, not just a diagram:

```
START → intake → gap → [route_after_gap] → roadmap? → save → END
```

- `intake` (no LLM) — loads the profile, populates `student_skills`, `target_role`,
  `location`, `time_per_week`, `budget` into `CareerState`.
- `gap` — merges four signals (claimed skills, market demand, interview proof, practice
  proof) into one report, plus an optional Groq narrative and `classify_gap_size` (the
  large/small roadmap-depth decision, computed exactly once here).
- `route_after_gap` — `error` → `END`; `run_roadmap=False` → straight to `save` (snapshot
  only); otherwise → `roadmap`.
- `roadmap` — generates a week-by-week plan sized by `gap_size`.
- `save` (no LLM) — persists the skill-gap snapshot (and roadmap, if generated).

`POST /api/gap` and `POST /api/roadmap` call the same underlying service functions directly
(to avoid re-running work across two already-tested endpoints) — the graph itself is the
independently-runnable reference pipeline:

```bash
uv run python -m app.orchestrator.run --profile-id <uuid>
```

**Gap agent** = deterministic 4-signal merge (`app/services/skill_gap.py`) + an optional Groq
narrative that is only ever allowed to explain numbers already computed — it cannot invent
skills, jobs, or scores. **Roadmap agent** = a plan generated from the gap report plus curated
learning resources. **Interview** and **practice** are separate API-driven agents (Mistral and
Groq respectively) whose scored results feed back into the gap agent as verification signals.

**RAG pipeline** — `scrape (merojob/kamkhoj/kumarijob) → data/jobs.json → BGE embeddings
(BAAI/bge-small-en-v1.5) → Chroma → search_jobs() / multi-factor job matching`. This is the
one and only source of "live Nepal jobs" shown to students.

**Data layer** — Neon Postgres (profiles, sessions, snapshots, roadmaps, scrape runs) +
Chroma (job embeddings) + `backend/app/data/skills_catalog.json` (the canonical skill list
used everywhere a skill is entered, suggested, or scored).

**External services** — Groq (skill-gap narrative, CV skill extraction, practice grading),
Mistral (resume OCR + interview LLM, on separate keys/quotas), Google Cloud TTS/STT (voice
interview, with an edge-tts/text-only fallback), and the job portals themselves.

> **Note:** `frontend/app/(platform)/jobs/lab` and `backend/datasets/Job Datsset.csv` are a
> separate **synthetic benchmark lab** for demoing content-based scoring — not live Nepal
> jobs. `POST /api/jobs/match` and the main `/jobs` page are the real thing, backed by Chroma.

## Key Features

| Feature | What it does |
|---|---|
| **Canonical skills catalog** | A fixed, versioned skill list per role (`GET /api/skills`) — onboarding, CV parsing, practice, skill gap, and job matching all normalize through it, so "ReactJS"/"React.js"/"React" are always the same skill. |
| **CV OCR + onboarding** | Mistral OCR extracts text from an uploaded PDF; Groq structures it into skills/education/experience for the student to review and confirm — never auto-saved unverified. |
| **Voice mock interview + report card** | A chat-style adaptive interview (Mistral) with Google TTS/STT, an off-topic/jailbreak guard that refuses to go off-script, and a detailed report card (per-turn scores, dimension breakdown, strengths/weaknesses, what to practice next). |
| **Skill practice game** | Timed coding or scenario challenges per skill, AI-graded, feeding `verified_strong_skills` / `verified_weak_skills` back into the gap report. |
| **Skill gap with evidence** | Four-signal merge (claimed / market / interview / practice) with a validation panel showing exactly which signals back each verdict and an accuracy level (High/Medium/Low). |
| **Multi-factor job matching** | Explainable scoring across skills, role similarity, seniority, domain, education, and location — with role-conflict rules so "AI Engineer" doesn't match "AI Instructor" and generic keywords don't inflate scores. |
| **Roadmap + auto-progress** | A personalized, budget/time-constrained learning path; opening a resource starts a dwell timer that prompts to mark it complete instead of requiring a blind manual checkbox. |
| **Learning curriculum agent** | A separate Mistral agent (its own key/quota) turns the skill gap into a sectioned, module-based curriculum of self-contained in-app lessons — explanation, steps, worked examples, and mini self-checks, written directly by the LLM and read entirely inside DISHA, with no external links out to YouTube/docs/other sites. |
| **Leaderboard category scores** | Real per-category scores (interview, practice, skill gap, roadmap %) — no synthetic users, only actual completed sessions. |
| **Admin panel** | `/admin`, same DISHA visual language as the student app, no login screen (dev-mode key from env) — platform stats, every student's full verification dossier, and read-only access to every interview report, practice session, gap snapshot, and roadmap across all students. |

## Monorepo Structure

```
disha.ai/
  frontend/   # Next.js 16 (App Router) — student app + /admin
  backend/    # FastAPI + LangGraph orchestrator + scraper + RAG
  README.md   # this file
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for
the full per-side layout.

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
# fill in: DATABASE_URL, GROQ_API_KEY (required)
# MISTRAL_API_KEY, MISTRAL_API_KEY2, ADMIN_API_KEY, GOOGLE_APPLICATION_CREDENTIALS (optional)

uv sync
uv run playwright install chromium
uv run alembic upgrade head

# optional — populate real Nepal job data (needed for skill gap / job matching to return results)
export CRAWL4AI_BASE_DIRECTORY=./.crawl4ai
./scripts/refresh_jobs.sh   # scrape + Chroma ingest in one step

uv run uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

**Backend** (`backend/.env`, see `backend/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `GROQ_API_KEY` | Yes | Skill-gap narrative, CV skill extraction, practice grading |
| `MISTRAL_API_KEY` | Recommended | Resume OCR (Mistral OCR 3) |
| `MISTRAL_API_KEY2` | Recommended | Mock interview LLM — separate key/quota from OCR |
| `ADMIN_API_KEY` | Recommended | Protects all `/api/admin/*` routes (`X-Admin-Key` header) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | Voice interview TTS/STT — falls back to edge-tts + text-only without it |
| `GROQ_API_KEY2` | Optional | Separate quota for voice STT (Whisper) |
| `HF_TOKEN` | Optional | Only needed if HuggingFace rate-limits anonymous embedding-model downloads |

**Frontend** (`frontend/.env.local`, see `frontend/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (default `http://127.0.0.1:8000`) |

No real secrets are committed anywhere in this repo — both `.env.example` files ship with
empty/placeholder values only.

## API Map

High level, by domain (full request/response shapes in [backend/README.md](backend/README.md)
and the live OpenAPI docs):

| Domain | Prefix | Examples |
|---|---|---|
| Profile | `/api/profile` | create/update profile, resume upload |
| Skills | `/api/skills` | canonical catalog, per-role skill list |
| Skill gap | `/api/gap` | combined report, market-only comparison, history |
| Jobs | `/api/jobs` | multi-factor match, corpus status, synthetic lab endpoints |
| Roadmap | `/api/roadmap` | generate plan, task/resource/node progress |
| Interview | `/api/interview` | start, answer (evaluate + next question), history |
| Practice | `/api/practice` | suggest skills, start, submit, history |
| Voice | `/api/voice` | TTS synthesis, STT transcription |
| Leaderboard | `/api/leaderboard` | ranked entries + category scores |
| Dashboard | `/api/dashboard` | one aggregated payload for the student dashboard |
| Admin | `/api/admin` | stats, users, user dossier, verification, scrape control |

## Student Journey

```
Onboarding (CV or manual) → Dashboard → Mock Interview / Skill Practice
   → Skill Gap Analysis → Personalized Roadmap → Job Matches → Leaderboard
```

Every step after onboarding reads real data computed by the steps before it — the roadmap is
built from the gap report, the gap report is strengthened by interview/practice results, and
job matches use the same catalog-normalized skills throughout.

## Admin

`/admin` opens directly — no login screen. It shares the same visual language as the student
app (logo, primary blue, white cards, Material icons) with its own left-nav chrome instead of
the student sidebar. The frontend reads `NEXT_PUBLIC_ADMIN_API_KEY` (same value as the
backend's `ADMIN_API_KEY`) and attaches it as `X-Admin-Key` on every `/api/admin/*` call
automatically. This is a **dev/local convenience, not real access control** — the key is
bundled into client-side JS — the backend's `require_admin` dependency (which checks the same
value server-side) is what actually protects the admin API. A discreet "Admin" link sits in
the student sidebar footer. Endpoints return `503` until `ADMIN_API_KEY` is set, `401` on a
mismatched key. No separate auth/login system exists yet.

From `/admin` a human reviewer can browse every student's full dossier (profile, skill gap,
roadmap, learning curriculum, job matches, leaderboard scores) and every interview report
read-only, at the same depth the student themselves sees — plus set a verification status
(`verified` / `needs_review` / `flagged`) with notes, and trigger/monitor the scrape pipeline.

## Docs

- [backend/README.md](backend/README.md) — backend architecture, orchestrator, RAG, scraper, all endpoints
- [frontend/README.md](frontend/README.md) — pages, session model, voice interview notes
- [backend/OPTIMIZATION_NOTES.md](backend/OPTIMIZATION_NOTES.md) — backend audit: bugs fixed, deliberate non-fixes

## License

Private academic project. All rights reserved. For permission or usage inquiries, contact the
repository owner.
