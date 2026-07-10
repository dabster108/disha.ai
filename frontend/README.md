# Disha AI — Frontend

Next.js 16 (App Router) app for the Disha AI career platform, wired end-to-end
to the FastAPI backend in `../backend`. No auth yet — the active student is
identified by `profile_id` in `localStorage`.

## Quick start

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if needed
npm install
npm run dev
```

Default API URL: `http://127.0.0.1:8000` (see `lib/api.js`). Run the backend
first (`cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000`).
Open http://localhost:3000 — the landing page CTA goes to `/onboarding` (or
straight to `/dashboard` if a profile is already stored locally).

## Structure

```
app/
  page.js                    # marketing landing page (Server Component)
  layout.js                  # root layout — wraps everything in ProfileProvider
  onboarding/page.js          # CV upload (optional) -> profile form -> createProfile
  (platform)/
    layout.js                 # Sidebar + TopHeader + ProfileGuard (redirects to /onboarding if no profile)
    dashboard/, journey/, skill-gap/, roadmap/, mock-interview/, practice/, jobs/, applications/, learning/
context/ProfileContext.jsx    # profile state + localStorage persistence, used everywhere
components/auth/ProfileGuard.jsx
components/ui/{LoadingState,ErrorBanner,EmptyState}.jsx
lib/api.js                    # the only place that calls the backend — apiFetch() wrapper + typed helpers
```

Every non-voice platform page follows the same shape: `"use client"`,
`useProfile()` for `profileId`, a `useEffect` calling one or more `lib/api.js`
functions, and `LoadingState`/`ErrorBanner`/`EmptyState` for the three
non-happy-path states. 404s from `GET /api/gap/{id}` and `GET /api/roadmap/{id}`
are expected before a student's first analysis/roadmap — `isNotFound()` in
`lib/api.js` distinguishes that from a real error.

## Skill gap latency — narrative is deferred

Skill gap analysis has a fast, deterministic part (Chroma market query +
profile/interview/practice merge) and a slow part (the Groq-written narrative
summary). Measured directly against the backend on the same profile: **4.8s
with the narrative vs 2.6s without it**. The skill-gap page's "Run Analysis"
now calls `include_narrative: false` by default so readiness score,
matched/missing skills, and the priority list appear as soon as the
deterministic part finishes; a separate "Generate AI Summary" button fetches
the narrative afterward, on demand, without blocking first paint. Roadmap
generation has no equivalent fast path — the plan itself *is* the Groq
output — so `/roadmap` isn't split this way.

## Endpoints wired (non-voice pages)

| Page | Calls |
|---|---|
| `/onboarding` | `uploadResume`, `createProfile` |
| `/dashboard`, `/journey` | `getLatestGap`, `getLatestRoadmap`, `getInterviewHistory`, `getPracticeHistory` (parallel via `Promise.allSettled`) |
| `/practice*` | `suggestPracticeSkills`, `startPractice`, `submitPractice`, `getPracticeSession`, `getPracticeHistory` |
| `/skill-gap` | `runSkillGap`, `getLatestGap`, `createRoadmap` |
| `/roadmap` | `getLatestRoadmap`, `createRoadmap`, `updateRoadmapProgress` |
| `/jobs` | `getLatestGap` (renders `gap_data.sample_jobs` — no dedicated jobs API yet) |

`/mock-interview*` is voice-first — see below.

## Live voice mock interview

The mock interview at `/mock-interview` is **voice-first** by default:

1. DISHA speaks each question via Google Cloud TTS (`POST /api/voice/tts`)
2. You record your answer with the microphone
3. Audio is transcribed via Google Cloud STT (`POST /api/voice/stt`)
4. The transcript is sent to the existing interview API as text

### Backend requirements

Voice endpoints require Google Cloud credentials on the **backend**:

```bash
# backend/.env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Start the API:

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

If credentials are missing or TTS/STT returns 503, the interview falls back to **text-only** with an on-screen notice. Questions and feedback still appear as captions.

### Microphone permissions

- The browser will prompt for microphone access on first recording
- If permission is denied, the app auto-switches to **text mode**
- Toggle between voice and text anytime with the **Text mode** button
- Preference is stored in `sessionStorage` for the current browser session

### Text mode fallback

Use **Text mode** when:

- You're in a quiet environment where speaking isn't possible
- Microphone hardware isn't available
- Google voice services are unavailable

### Supported audio format

Recordings use `audio/webm` (browser `MediaRecorder`). The backend STT accepts webm and wav.

### Auto-continue

With **Auto-continue after feedback** enabled (default), DISHA reads feedback via TTS and advances to the next question automatically after a short pause. Disable it in the session sidebar to read feedback at your own pace.

## Key files

| Path | Purpose |
|------|---------|
| `hooks/useVoiceInterview.js` | Interview session state machine (TTS, STT, turns) |
| `hooks/useAudioRecorder.js` | Microphone capture + volume analyser |
| `components/interview/` | Live session UI (stage, mic, transcript, sidebar) |
| `app/(platform)/mock-interview/active/page.js` | Active voice interview page |
| `lib/api.js` | `synthesizeSpeech()`, `transcribeAudio()`, interview APIs |

## Phase 2 (not implemented)

- Streaming STT (word-by-word interim results)
- Real-time bidirectional voice (OpenAI Realtime, Gemini Live)
- Webcam video analysis
- Nepali TTS/STT

## Testing

No test framework is wired up yet. The non-voice flow was verified with a
scripted Playwright run driving the real backend end-to-end: onboarding →
profile creation → skill practice (3 skills, real challenge generation +
grading) → skill gap analysis (real readiness score + priority list) →
roadmap generation (real week-by-week plan, hours respecting `time_per_week`)
→ journey → jobs. All pages loaded with real data end to end. Issues found
and fixed along the way: a duplicate React `key` warning (`sample_jobs` rows
can share `title`+`company`, now keyed with an index tiebreaker) and a
`useProfile` crash on `/onboarding` (`ProfileProvider` was only wrapping the
`(platform)` route group; `/onboarding` sits outside it, so the provider
moved to the root layout).

Two more found from real dashboard use (job match showing "102% match", and a
"Video Editor" posting appearing for an "AI Engineer" query):

- **Match score exceeded 100%** — `app/rag/retriever.py`'s `_hybrid_score()`
  adds title/skill/category boost bonuses on top of the semantic similarity,
  and only clamped the *lower* bound (`max(0.0, score)`). A strong semantic
  match plus every boost firing could sum past 1.0. Fixed by clamping both
  ends (`min(1.0, max(0.0, score))`) — this is a backend fix, since
  `similarity` is displayed as a percentage on `/dashboard`, `/jobs`, and
  wherever else `sample_jobs` is rendered.
- **Irrelevant job in the top 5** — traced with `search_jobs("AI Engineer", debug=True)`:
  the "Video Editor" posting has `Machine Learning` tagged as one of its
  scraped skills (likely a false-positive from keyword-based skill
  extraction), which both categorizes it as `ml_ai` and inflates its semantic
  score against AI-flavored queries. This is a scraped-data-quality issue,
  not a scoring bug — `_hybrid_score()` is behaving reasonably given
  polluted input. A proper fix means cleaning up skill extraction or making
  category detection trust title text more than skills when they disagree;
  deferred rather than rushed, since `documents.py`'s domain/category logic
  is otherwise solid (see `backend/OPTIMIZATION_NOTES.md`) and a speculative
  change risks regressing it without dedicated test coverage.

## Roadmap completion

Finishing every task in a week auto-collapses it and expands the next one
(`toggleTask` in `roadmap/page.js`, driven by the freshly-returned
`progress.completed` after each `PATCH .../progress` call — not by re-fetching).
Finishing every task in the whole roadmap shows a completion banner prompting
a re-run of the skill gap analysis, since real progress should show up as a
higher readiness score next time.

## Known gaps

- No job matching API yet — `/jobs` and dashboard job cards are sourced from
  `gap_data.sample_jobs` (max 5 entries, no location/salary/required-skills
  fields — those exist only in `POST /api/gap/market`'s richer shape).
- `/applications` is a static empty-state placeholder — no backend support yet.
- No auth — `profile_id` in `localStorage` is the only "session."
