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

- `GROQ_API_KEY` — LLM (skills, roadmaps, skill-gap narrative)
- `DATABASE_URL` — Neon Postgres
- `MISTRAL_API_KEY` — PDF resume OCR (Mistral OCR 3)
- `MISTRAL_API_KEY2` — separate key/quota for the interview LLM (chat, not OCR — see below)
- `ADMIN_API_KEY` — protects `POST /api/admin/scrape`
- `GOOGLE_APPLICATION_CREDENTIALS` — path to your Google Cloud service account JSON for TTS/STT

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
| `POST /api/interview/start` | create adaptive interview session from saved profile |
| `POST /api/interview/answer` | score one answer and generate the next question |
| `GET /api/interview/{student_id}/history` | fetch stored interview sessions + turns |
| `POST /api/voice/tts` | generate spoken audio from text using Google Cloud TTS |
| `POST /api/voice/stt` | transcribe uploaded audio using Google Cloud Speech-to-Text |
| `POST /api/roadmap` | 501 — next phase |

The interview's question generation, answer evaluation, and summary all run on
`ChatMistralAI` (`interview_mistral_model`, default `mistral-small-latest`) using
`MISTRAL_API_KEY2` — a separate key from OCR's `MISTRAL_API_KEY`, kept on its own
quota. This replaced Groq after testing showed Groq's small model intermittently
returning malformed tool calls under the interview's multi-field structured output,
producing generic fallback text instead of a real evaluation. Every LLM call
(interview, practice, skill gap) now goes through `app/services/llm_utils.py`'s
`call_structured()`, which retries once before falling back to a deterministic
template — so a single flaky response never surfaces as a 500 to the student.

## Skill practice / game endpoints

Practice one skill at a time — separate from `/api/interview` (own tables). Student
picks 1–3 skills; each gets one challenge (coding for tech track, scenario for
non-tech), AI-scored 0–10 and passed at `practice_pass_threshold` (default 7.0).
Challenges are generated lazily (one Groq call per request) and difficulty adapts
to the previous score. Groq only — no code execution in this MVP (AI review of the
submitted code/answer; API is shaped for a sandboxed runner later).

| Endpoint | What it does |
|---|---|
| `POST /api/practice/skills/suggest` | `{profile_id}` → suggested skills + track (tech/nontech) from the profile |
| `POST /api/practice/start` | `{profile_id, skills[1–3], difficulty: easy\|medium\|hard\|auto}` → session + first challenge |
| `POST /api/practice/{session_id}/submit` | coding: `{challenge_id, code, explanation?}`; scenario: `{challenge_id, answer}` → score, passed, next challenge or session summary |
| `GET /api/practice/{session_id}` | fetch a session with all challenges |
| `GET /api/practice/history/{profile_id}` | all practice sessions for a profile |

Session end returns a combined-gap-ready shape: `verified_strong_skills`,
`verified_weak_skills`, and `skill_scores` (`{skill: 0–10}`). `difficulty=auto`
infers from `years_of_experience`. Tech coding challenges also return
`starter_code` + `expected_language` (python/javascript/sql) for a Monaco editor.

```bash
# 1. Suggest skills from a saved profile
curl -X POST http://127.0.0.1:8000/api/practice/skills/suggest \
  -H "Content-Type: application/json" -d '{"profile_id":"<uuid>"}'

# 2. Start (tech — Python + SQL)
curl -X POST http://127.0.0.1:8000/api/practice/start \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"<uuid>","skills":["Python","SQL"],"difficulty":"auto"}'

# 3. Submit code for the current challenge
curl -X POST http://127.0.0.1:8000/api/practice/<session_id>/submit \
  -H "Content-Type: application/json" \
  -d '{"challenge_id":"<uuid>","code":"def solve(): ...","explanation":"..."}'

# 4. Final session (summary + verified skills)
curl http://127.0.0.1:8000/api/practice/<session_id>
```

Config (`app/config.py`): `practice_pass_threshold` (7.0),
`practice_max_skills_per_session` (3), `practice_groq_model`.

## Unified skill gap agent

The brain of Disha: merges **four signals** into one report and saves it as a
`skill_gap_snapshots` row (history kept — `GET` returns the latest by default).

1. **Claimed skills** — `student_profiles.skills` (what the student says they have)
2. **Market demand** — Chroma `search_jobs(target_role)` (what Nepal employers want)
3. **Interview proof** — latest *completed* interview: any `skill_tag` scored `<5` → weak, `>=7` → strong
4. **Practice proof** — latest *completed* practice session: its own `verified_strong_skills` / `verified_weak_skills`

Practice signal wins over interview signal for the same skill (it's a dedicated
skill test); a **weak** rating always overrides a **strong** one for the same
skill regardless of source, so one bad showing on a claimed skill still surfaces.

Every skill lands in one or more buckets: `matched` (claimed + market wants),
`market_missing` (market wants, not on CV), `verified_strong` / `verified_weak`
(from interview/practice), `overclaimed` (claimed but proved weak), or
`claimed_unverified` (on CV, never tested). `priority_learn` ranks the union of
all skills by a documented 0–100 formula (see comments in
`app/services/skill_gap.py`) — jobs-in-demand capped at 40, +20 weak, +15
market-missing, +10 overclaimed, −15 strong, −10 matched-and-not-weak.
`readiness_score` (0–100) blends match ratio, verified-strong ratio, interview
score, and practice pass rate. `roadmap_inputs` (top-5 priority skills,
`time_per_week`, `budget`, `readiness_score`, a 2-weeks-per-skill estimate) is
ready for the next phase's roadmap agent — nothing else reads it yet.

The narrative (`generate_gap_narrative`, Groq) explains the computed
`gap_data` in English + one Nepali line — it is instructed to invent nothing,
only cite numbers/skills/jobs already in the payload; if Groq fails, a
deterministic fallback narrative is built from the same data.

| Endpoint | What it does |
|---|---|
| `POST /api/gap` | `{profile_id, interview_session_id?, practice_session_id?, include_narrative?, n_jobs?}` → combined report, saved as a snapshot. Omitted session ids default to the latest *completed* session of that type. |
| `POST /api/gap/market` | `{profile_id}` or `{skills, target_role}` → market-only comparison (no interview/practice merge; unchanged from the original `compute_skill_gap`) |
| `GET /api/gap/{profile_id}` | latest snapshot |
| `GET /api/gap/{profile_id}/history?limit=10` | snapshot history |

```bash
# 1. Combined gap — uses latest completed interview + practice automatically
curl -X POST http://127.0.0.1:8000/api/gap \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"<uuid>","include_narrative":true}'

# 2. Latest snapshot
curl http://127.0.0.1:8000/api/gap/<profile_id>
```

Response shape (truncated):
```json
{
  "id": "snapshot-uuid",
  "gap_data": {
    "readiness_score": 58,
    "match_ratio": 0.42,
    "matched_skills": [{"skill": "Python", "jobs_requiring": 14, "status": "matched"}],
    "market_missing_skills": [{"skill": "Docker", "jobs_requiring": 9, "priority_score": 85}],
    "verified_strong_skills": [{"skill": "FastAPI", "source": "practice", "score": 8.5}],
    "verified_weak_skills": [{"skill": "SQL", "source": "practice", "score": 4.0}],
    "overclaimed_skills": [{"skill": "PyTorch", "claimed": true, "score": 3.5, "source": "practice", "reason": "..."}],
    "interview_insights": {"overall_score": 6.8, "strengths": [...], "weaknesses": [...]},
    "priority_learn": [{"skill": "Docker", "priority_score": 85, "reason": "9 Nepal jobs require it; not on CV"}],
    "roadmap_inputs": {"priority_skills": [...], "time_per_week": 15, "budget": "free", "estimated_weeks": 8}
  },
  "narrative_summary": "You're at 58% readiness for the Backend Developer role... तपाईं सफल हुनुहुनेछ!"
}
```

Config (`app/config.py`): `gap_n_jobs` (20), `gap_include_narrative_default` (true).
The LangGraph `gap_node` (`app/orchestrator/nodes/gap.py`) runs the same combined
agent when `profile_id` is present in state, falling back to market-only otherwise
— not wired to any endpoint yet, prepared for the roadmap phase.

## Architecture

- **Chroma** = job market vectors only (`search_jobs` for skill gap)
- **Postgres** = student profiles + `scrape_runs` telemetry
- **jobs.json** = human-readable scrape output; ingest into Chroma after each run
- Logs: `data/logs/scrape-{timestamp}.log` when using `--log-file`
