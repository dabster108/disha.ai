<p align="center">
  <img src="components/images/logo.png" alt="DISHA AI Logo" width="120" />
</p>

# DISHA AI — Frontend

Next.js 16 (App Router) app for the DISHA AI career platform, wired end-to-end to the FastAPI
backend in `../backend`. See the [root README](../README.md) for the product overview and
architecture, and [../backend/README.md](../backend/README.md) for the API side.

<p align="center">
  <img src="components/images/architecture.jpg" alt="DISHA AI Architecture" width="700" />
</p>

No auth system yet — the active student is identified by `profile_id` in `localStorage`. The
admin panel (`/admin`) uses a separate, lighter gate (an admin key stored in
`sessionStorage`) — see below.

## Quick start

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm install
npm run dev
```

Run the backend first (`cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000`).
Open http://localhost:3000 — the landing page CTA goes to `/onboarding` (or straight to
`/dashboard` if a profile is already stored locally).

## Structure

```
app/
  page.js                     # marketing landing page (Server Component)
  layout.js                   # root layout — wraps everything in ProfileProvider
  onboarding/page.js          # CV upload (optional) -> catalog skill picker -> createProfile
  (platform)/
    layout.js                 # Sidebar + TopHeader + ProfileGuard (redirects to /onboarding if no profile)
    dashboard/, journey/, skill-gap/, roadmap/, learning/, mock-interview/,
    practice/, jobs/, jobs/lab/, applications/, leaderboard/
  admin/
    layout.js                  # separate key-gated chrome — NOT the student sidebar
    page.js, users/, users/[id]/, scrape/, jobs/, leaderboard/, skills/
context/ProfileContext.jsx      # profile + dashboard-aggregate state, localStorage persistence
components/auth/ProfileGuard.jsx
components/ui/{LoadingState,ErrorBanner,EmptyState}.jsx
components/images/{logo.png,architecture.jpg}
hooks/useResourceStudyTracker.js  # roadmap/learning "open resource -> dwell -> confirm complete" flow
lib/api.js                       # the only place that calls the student-facing backend — apiFetch() wrapper + typed helpers
lib/adminApi.js                  # same pattern for /api/admin/* — attaches X-Admin-Key
lib/journeyState.js              # shared journey-step + roadmap-progress computation (dashboard + journey pages agree)
lib/dashboardData.js             # typed selectors over the dashboard aggregator payload
```

Every non-voice platform page follows the same shape: `"use client"`, `useProfile()` for
`profileId`, a `useEffect` calling one or more `lib/api.js` functions, and
`LoadingState`/`ErrorBanner`/`EmptyState` for the three non-happy-path states. 404s from
`GET /api/gap/{id}` and `GET /api/roadmap/{id}` are expected before a student's first
analysis/roadmap — `isNotFound()` in `lib/api.js` distinguishes that from a real error.

## Pages map

| Page | Purpose |
|---|---|
| `/onboarding` | CV upload (optional) → review parsed fields → catalog-only skill picker → create profile |
| `/dashboard` | One aggregated view: smart next-action, readiness/roadmap/interview/job stats, analytics, skill snapshot, this-week roadmap, top job matches, your leaderboard scores & rank, quick links |
| `/journey` | Step-by-step career journey (profile → gap → interview → practice → roadmap), same completion truth as the dashboard via `lib/journeyState.js` |
| `/skill-gap` | Run/view the 4-signal gap report: readiness gauge, validation/evidence panel, skills (matched/strong/weak/overclaimed), priority-to-learn with score bars, market evidence with real job cards, role & technical differentiation, CTAs to practice/roadmap/jobs |
| `/roadmap` | Skill-path (or legacy week) view; click a resource to open it and start a study-dwell timer that prompts to mark it complete |
| `/learning` | Flat "next incomplete resource" queue across the whole roadmap, same auto-progress tracker as `/roadmap` |
| `/mock-interview` | Duration picker (default 1 min — temporary, see note below) → start session |
| `/mock-interview/active` | ChatGPT-style voice/text chat interview |
| `/mock-interview/report` | Detailed report card: score + label, per-turn breakdown with dimension bars and off-topic flags, strengths/weaknesses, "what to practice next," print-friendly |
| `/practice` | Pick 1–3 catalog skills, timed coding/scenario challenges, AI-graded |
| `/jobs` | Real, explainable job matches (`POST /api/jobs/match`) — score, matched/missing skills, Apply link |
| `/jobs/lab` | **Synthetic benchmark lab** — clearly banner'd as not-Nepal-jobs, demos content scoring against the public CSV dataset |
| `/leaderboard` | Ranked entries with per-category score bars (interview/practice/gap/roadmap) |
| `/applications` | Track saved jobs from `/jobs` through saved → applied → interview → offer |
| `/admin` | Key-gated: overview stats, user list, per-student verification dossier, scrape controls, jobs corpus status, admin leaderboard view, read-only skills catalog view |

## Profile / session model

No login. `ProfileContext` (`context/ProfileContext.jsx`) holds:

- `profileId` — set synchronously from `localStorage` on mount (no network wait)
- `profile` — the full profile object, fetched async
- `dashboard` — the aggregated `GET /api/dashboard/{id}` payload, cached ~60s
  (`dashboardFetchedAt` ref) and force-refreshed on profile creation/update

`(platform)/layout.js` wraps every platform page in `ProfileGuard`, which redirects to
`/onboarding` if no `profile_id` is stored. `/onboarding` itself sits **outside** the
`(platform)` route group (no sidebar), so `ProfileProvider` lives in the **root** `layout.js`,
not the platform one.

## Admin panel session model

Separate from the above. `app/admin/layout.js` checks `sessionStorage` for an admin key on
mount; if absent (or invalid), it shows a key-entry form. Once a key round-trips successfully
against `GET /api/admin/stats`, it's stored in `sessionStorage` and attached as `X-Admin-Key`
to every subsequent `/api/admin/*` call via `lib/adminApi.js`'s `adminFetch()`. "Lock" clears
the stored key. This is intentionally lighter than a real auth system — it's a gate, not a
user model.

## Canonical skills everywhere

`SkillMultiSelect` (onboarding) fetches `GET /api/skills` (full catalog + alias map) and
`GET /api/skills/by-role?role=...` (role-specific suggestions), and validates any free-text
entry against the catalog client-side before adding it — an unrecognized skill is rejected
with an inline message rather than silently saved. The backend enforces the same catalog on
CV parsing, practice suggestions, and skill-gap/job-matching normalization, so a skill entered
once means the same thing everywhere downstream.

## Roadmap resource auto-progress

`hooks/useResourceStudyTracker.js` + `components/learning/StudyTrackerChip.jsx`, shared by
`/roadmap` and `/learning`: clicking a resource link opens it in a new tab and starts a dwell
timer. Returning to the tab after 45+ seconds shows a floating "Mark this complete? Yes / Not
yet" confirmation instead of silently auto-ticking (a manual "Mark done" button is also always
available). Confirming calls the same `updateRoadmapProgress` / `updateRoadmapNodeProgress`
endpoints as the manual checkboxes.

## Live voice mock interview

The mock interview at `/mock-interview` is **voice-first** by default, rebuilt as a
ChatGPT-style chat thread (`/mock-interview/active`):

1. DISHA speaks each question via Google Cloud TTS (`POST /api/voice/tts`), captioned live in the chat
2. You record your answer with the microphone (or type, in text mode) — it auto-sends when you stop talking
3. Audio is transcribed via Google Cloud STT (`POST /api/voice/stt`)
4. The transcript is sent to the interview API as text; feedback + the next question appear as new chat bubbles, and voice auto-continues into listening for the next answer

> **Temporary:** the duration picker defaults to **1 minute** for testing (5/10/15/30 options
> still available) — see the `// TEMP` comments in `app/(platform)/mock-interview/page.js` and
> `lib/interviewUtils.js`. Restore the 15-minute default before shipping.

Off-topic answers (including prompt-injection attempts) get a fixed refusal line from DISHA
("I cannot provide you with that — this is a mock interview...") and the same question
repeated, rather than the interview being derailed — enforced server-side, see
[../backend/README.md](../backend/README.md#profile--cv-endpoints).

### Backend requirements

Voice endpoints require Google Cloud credentials on the **backend**:

```bash
# backend/.env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

If credentials are missing or TTS/STT returns 503, the interview falls back to **edge-tts**
(free neural voice) and then **text-only** with an on-screen notice. Questions and feedback
still appear as chat bubbles either way.

### Microphone permissions

- The browser will prompt for microphone access on first recording
- If permission is denied, the app auto-switches to **text mode**
- Toggle between voice and text anytime with the **Text mode** button
- Preference is stored in `sessionStorage` for the current browser session

### Supported audio format

Recordings use `audio/webm` (browser `MediaRecorder`). The backend STT accepts webm and wav.

## Key files

| Path | Purpose |
|---|---|
| `hooks/useVoiceInterview.js` | Interview session state machine (chat messages, TTS, STT, off-topic-aware turns) |
| `hooks/useAudioRecorder.js` | Microphone capture + volume analyser |
| `hooks/useResourceStudyTracker.js` | Roadmap/learning open-resource → dwell → confirm-complete flow |
| `components/interview/` | Chat thread UI (bubbles, typing indicator, composer) |
| `components/roadmap/` | Skill-path header, path view, individual node cards |
| `components/dashboard/` | Stat cards, smart CTA, analytics, skill-gap snapshot, score/rank section |
| `app/(platform)/mock-interview/active/page.js` | Active voice/chat interview page |
| `app/(platform)/mock-interview/report/page.js` | Detailed report card |
| `lib/api.js` | `synthesizeSpeech()`, `transcribeAudio()`, and every other student-facing endpoint wrapper |
| `lib/adminApi.js` | Admin-key-gated fetch wrapper for `/api/admin/*` |

## Phase 2 (not implemented)

- Streaming STT (word-by-word interim results)
- Real-time bidirectional voice (OpenAI Realtime, Gemini Live)
- Webcam video analysis
- Nepali TTS/STT
- Real auth (current session model is `profile_id` in `localStorage` + an admin key in `sessionStorage`)

## Testing

No frontend test framework is wired up yet. Every page listed above has been verified against
the live backend (real profiles, real scrape data, real interview/practice/gap runs) rather
than mocked — see `../backend/README.md`'s Tests section for the backend's `pytest` suite.
