# Disha AI

**Your direction. Nepal's data. Your future.**

An agentic AI platform that tells Nepali students exactly what skills they are missing for the job they want, builds a personal week by week plan to close that gap, and connects them directly to real employers hiring right now in Nepal.

---

## The problem

**Truth 1 — Students don't know what to learn**
Colleges teach outdated syllabi. A BCA graduate learns C++ and theory while every real job posting asks for React, Node.js, and cloud tools. Nobody translates "what you studied" into "what the market wants."

**Truth 2 — Career guidance is a privilege, not a right**
A student in Kathmandu has seniors, mentors, and paid institutes. A student in Dang or Jumla has the same intelligence and none of the access.

**Truth 3 — Nepal is bleeding its best minds**
Over 400,000 educated Nepalis leave every year, not because Nepal has no jobs, but because nobody ever showed them the path from where they are to a job that actually exists here.

## The solution

Disha reads Nepal's live job market daily, compares it against what a student already knows, and builds a personal roadmap to close the gap, then prepares the student to actually get hired. This is an agentic system, a set of specialist agents that plan, retrieve real data, reason step by step, and adapt as the student progresses, grounded in a retrieval layer built from real Nepali job postings and learning resources, so answers are Nepal-specific, not generic global advice.

---

## User flow

1. **Sign up / log in** — basic auth, one account per student.
2. **Onboarding** — student either uploads their CV (parsed automatically into a skills list) or manually enters skills, plus their target job role, location, time available per week, and budget.
3. **View skill gap** — the system compares the student's skills against real, current job postings for their target role and shows exactly what's missing.
4. **Get weekly roadmap** — a week by week learning plan generated from the gap, using the student's time and budget constraints.
5. **Return anytime** — the student can check progress, mark roadmap items complete, chat with the Nepali-language career counselor, practice with the mock interview agent, or view matched jobs. The roadmap adapts automatically if they fall behind or pull ahead.

---

## Architecture

Two parallel input paths feed one orchestrator, which produces the gap and roadmap output.

**Input path 1 — CV upload and parsing**
Student uploads a resume (PDF/DOCX). Text is extracted, then sent to Claude to parse into a structured skills list. This is document parsing, not scraping, and is independent of the job market data pipeline. Students can also skip this and enter skills manually through a form; both paths produce the same structured skills list.

**Input path 2 — multi-site scraper feeding RAG**
Crawl4AI scrapes multiple Nepal job portals, not just one: merojob, jobaxle, and kumarijob. Each site needs its own scraping logic since HTML structures differ, but all output is normalized into the same structured format (title, company, location, required_skills, salary_range, source_url) and saved to `data/jobs.json`. This data is chunked and embedded into a Chroma vector store. Scraping runs as a scheduled job, not live per user request.

**LangGraph orchestrator with MCP tool layer**
The orchestrator receives the student's parsed skills and target role, then calls out to specialist logic as MCP tools (not hardcoded function calls) — for example, a `search_jobs` / `get_required_skills` tool wrapping RAG queries against the vector store. This is where the skill gap comparison and roadmap generation actually happen, orchestrated as a graph rather than a single linear prompt, so the flow can branch (e.g., large gap routes to a longer roadmap, small gap routes toward interview prep).

**Output**
Structured skill gap report and week by week roadmap, delivered back to the student, both saved to their profile for the return/progress flow.

---

## Full feature list

1. **Live job market scanner** — Crawl4AI across multiple Nepal job portals daily.
2. **AI skill gap analyzer** — compares student skills (from CV or manual entry) against real current job postings for the target role.
3. **Personalized learning roadmap** — week by week plan built from the gap, time, and budget, auto-updating as the student progresses.
4. **Disha AI chatbot (Nepali)** — answers career questions in Nepali using real Nepal salary and job market data.
5. **AI mock interview engine** — adaptive practice interviews scoring content, confidence, and communication.
6. **Smart job matching** — ranks live postings against the student's skill vector with a transparent remaining gap per match.
7. **College placement dashboard** — aggregate view of student skill levels and placement readiness.
8. **Progress tracker and path adaptation** — monitors progress and triggers roadmap replanning automatically.
9. **CV upload and parsing** — alternative to manual skill entry, extracts skills from an uploaded resume.
10. **MCP tool layer** — job market search and skill lookup exposed as a real MCP server, called by the orchestrator through the protocol.

---

## API endpoints

**Auth**
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

**Profile**
- `POST /api/profile` — save skills, target role, location, time/budget
- `GET /api/profile/{student_id}`
- `PUT /api/profile/{student_id}`
- `POST /api/profile/upload-resume` — upload CV, extract and pre-fill skills

**Skill gap**
- `POST /api/gap` — student skills + target role → missing skills, matched jobs count

**Roadmap**
- `POST /api/roadmap` — generate from gap + constraints
- `GET /api/roadmap/{student_id}`
- `PATCH /api/roadmap/{student_id}/progress` — mark task/week complete, triggers replan if behind

**Chat (Nepali)**
- `POST /api/chat` — student_id + message → reply

**Mock interview**
- `POST /api/interview/start` — role → first question
- `POST /api/interview/answer` — question + answer → score + next question
- `GET /api/interview/{student_id}/history`

**Job matching**
- `GET /api/jobs` — list/search by role, location
- `GET /api/jobs/{job_id}`
- `POST /api/jobs/match` — student_id → ranked job matches with remaining gap per match

**College dashboard**
- `GET /api/college/{college_id}/students`
- `GET /api/college/{college_id}/stats`

**Progress tracker**
- `GET /api/progress/{student_id}`
- `POST /api/progress/{student_id}/check` — triggers autopilot replan check

---

## Stack

- **Backend:** Python, FastAPI, uv for dependency management
- **Frontend:** Next.js, TypeScript, Tailwind
- **Orchestration:** LangGraph as the main agent orchestrator
- **Scraping:** Crawl4AI across multiple Nepal job portals (merojob, jobaxle, kumarijob)
- **Vector store:** Chroma, for RAG over job postings and learning resources
- **Relational DB:** SQLite to start (student profiles, progress, roadmap state), Postgres later
- **MCP:** official Python MCP SDK for the job market / skill lookup tool, called via `langchain-mcp-adapters`
- **LLM:** Claude via the Anthropic API

---

## Build order

Work through these layers one at a time. Each layer should be fully working and tested before starting the next one.

1. **Multi-site scraper** — Crawl4AI across merojob, jobaxle, and kumarijob, normalized into one `data/jobs.json` format. Confirm real data before moving on.
2. **RAG vector store** — chunk and embed `jobs.json` into Chroma, test retrieval quality with a sample query.
3. **CV upload and parsing** — file upload endpoint, text extraction, Claude call to produce a structured skills list. Can be built in parallel with step 2 since it doesn't depend on the scraper.
4. **MCP tool** — wrap the job search / skill lookup logic as a real MCP server using the official SDK.
5. **Core chain** — a standalone script: student skills + target role in, skill gap + roadmap JSON out, calling the MCP tool. Test this directly before wiring any API.
6. **LangGraph orchestrator** — wrap the core chain as a graph (intake → skill gap agent → roadmap agent), calling the MCP tool through `langchain-mcp-adapters`.
7. **FastAPI endpoints** — expose `/api/gap` and `/api/roadmap` first, test via `/docs` before touching the frontend. Add remaining endpoints (auth, profile, interview, jobs, chat) after the core loop works.
8. **Frontend** — Next.js form and results view wired to the real endpoints.
9. **Remaining features** — mock interview, job matching, college dashboard, progress tracker, Nepali chatbot, layered on once the core skill gap and roadmap loop is proven end to end.