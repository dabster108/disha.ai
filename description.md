# DISHA AI — Backend, Explained From Zero

This is a "defend your project" doc: what every piece does, why it was built that
way, and the exact numbers behind it — so any "why not X instead?" question has a
real answer, not a guess.

---

## 0. Concepts explained simply (read this first)

Skip this section if you already know these words. It exists so nothing later in
this doc assumes knowledge you don't have yet. Every term here is used for real
somewhere below, this is just the plain-English version before the deep dive.

**LLM (Large Language Model).** A big AI model (we use Groq and Mistral) that
reads text and predicts the next best words to write. It has no database and no
real memory of facts. It has only learned patterns from huge amounts of text, so
it is really good at sounding right, which is not the same as being right.

**Hallucination.** When an LLM confidently makes up something false, a fake
skill, a fake job, a fake number, because it is only predicting "what sounds
right" instead of looking anything up. This is the single biggest risk of putting
an LLM in a real product, and most of the design choices in this doc exist to
stop it (short version: never let the LLM be the only source of a fact that
matters). See the dedicated Q&A on this in Section 13.

**Embedding.** A way to turn a piece of text into a list of numbers (called a
vector) that captures its meaning. Two pieces of text that mean similar things
end up with number-lists that are close together. This is what lets a computer
search "by meaning" instead of by exact matching words.

**Vector database.** A database built to store these number-lists and quickly
find which ones are closest to a given search vector. We use Chroma for this.
Full detail, and why Chroma specifically, is in Section 2.

**RAG (Retrieval-Augmented Generation).** Instead of asking an LLM to answer
purely from what it remembers (which risks hallucination), you first fetch real,
relevant documents from your own data, then hand those documents to the LLM and
ask it to answer using only that. In this project, RAG means: find real, scraped
Nepal job postings that match a student, and only ever talk about jobs that are
actually in that fetched list, never a job the LLM imagined.

**Chunking.** When one document is too long to embed well as a single piece, you
split it into smaller, sometimes overlapping pieces ("chunks") before embedding
each one separately. This project does not need it, because a job posting is
already short. Section 2 explains exactly why, in detail.

**Semantic search.** Searching by meaning (using embeddings plus a vector
database) instead of by exact keyword match. "Backend Developer" and
"Server-Side Engineer" can be found as similar even though they share almost no
exact words.

**Structured output.** Instead of letting an LLM reply with a free-form
paragraph, you force its reply into a fixed shape (a strict schema with named
fields, like "title", "skills", "score"). This makes the reply something your
code can safely read, instead of something your code has to guess-parse.

**MCP (Model Context Protocol).** An open standard that lets an app call outside
tools (a web search tool, a documentation lookup tool) through one common
protocol, instead of writing custom one-off integration code for every single
tool. Think of it like a USB port for AI tools: any MCP-compatible tool can plug
into any MCP-compatible app the same way. Full detail in Section 9.

---

## 1. The 30-second version

A student uploads a CV (or fills a form) → the system OCRs/parses it into
structured skills → compares those skills against **live scraped Nepal job
postings** using semantic search → produces a skill-gap report → generates a
roadmap / in-app learning curriculum → lets the student prove skills via a mock
interview and a practice game → matches them to real jobs → ranks them on a
leaderboard. An admin panel lets a human verify all of it.

Two databases, two jobs:
- **Neon Postgres** — structured data: profiles, sessions, snapshots, roadmaps.
  Anything you'd `WHERE`, `JOIN`, or update field-by-field.
- **Chroma (vector DB)** — the 396 scraped job postings, embedded, for semantic
  search. Anything you'd search by *meaning* instead of exact match.

Two LLM vendors, on purpose:
- **Groq** (Llama 3.1 8B) — CV structuring, skill-gap narrative, practice grading.
  Fast and cheap; good enough for these.
- **Mistral** (`mistral-small-latest`, separate keys per feature) — mock interview,
  learning-curriculum generation. Groq's small model intermittently emits
  malformed tool calls under complex structured-output schemas; Mistral is
  steadier for these specific multi-field schemas. This was found empirically,
  not assumed — it's a documented reason in the code (`cv_parser.py`).

---

## 2. RAG pipeline (the "why not Qdrant" question)

### What "RAG" means here, concretely

RAG = Retrieval-Augmented Generation. In this project it is used for exactly one
thing: **finding which real, scraped Nepal job postings are relevant to a
student's skills/target role**, so that every claim in the skill-gap report and
job-match list is backed by an actual posting, not an LLM guess.

Pipeline, in order:

```
scraper (7 sources) → data/jobs.json → job_to_document() → BGE embeddings
   → Chroma (persistent, on-disk) → search_jobs() hybrid rerank → consumers
   (skill gap, job matching, roadmap context, dashboard)
```

### Why Chroma, not Qdrant / Pinecone / Weaviate / FAISS?

This is the single biggest "why this and not that" question, so the honest,
complete answer:

| Requirement | What it rules out |
|---|---|
| **Self-hosted, no external service, no API key, no network call for search** | Pinecone (managed SaaS only — needs an account, API key, network round-trip per query, and a paid tier past a small free quota) |
| **Embeds directly in the Python process, zero infra to run/deploy** | Qdrant and Weaviate normally run as a **separate server process** (Docker container / binary) that the app talks to over HTTP/gRPC — one more moving part to install, configure, keep running, and deploy alongside FastAPI. For a project of this size (396 jobs, single-node), that's operational overhead with no real benefit. |
| **Persists to a local folder, survives restarts, no schema migration ceremony** | `chromadb.PersistentClient(path=...)` just writes to `backend/data/chroma/` — a folder in the repo. Qdrant/Weaviate want you to define collections/schemas against a running server. |
| **Corpus size is ~400 documents** | At this scale, Qdrant/Milvus's actual selling point — horizontally-scaled ANN indexes over millions/billions of vectors with sub-100ms latency — is not a problem this project has. HNSW over 400 vectors is instant in *any* of these libraries; there is no performance argument for a heavier vector DB here. |
| **One dependency, one `pip install`** | `chromadb` ships as a normal Python package with an embedded (or persistent-local) mode. Qdrant's Python client either talks to a server or runs an experimental in-memory mode with fewer guarantees. |

**In one sentence for a defense**: *Qdrant/Weaviate are built for production-scale
vector search behind a dedicated server process — the right tool when you have
millions of vectors and need a scalable service. This project has ~400 job
postings and needs the vector index to be indistinguishable from "just a Python
library" so it can run embedded inside the same FastAPI process with zero extra
infrastructure — that's exactly Chroma's design point, not Qdrant's.*

If the corpus grew to hundreds of thousands of jobs across many cities/countries,
Qdrant (or pgvector inside the existing Postgres) would become the right call —
that's an explicit, honest scaling answer, not a weakness to hide.

**Why not pgvector** (since Postgres is already used)? Reasonable alternative,
genuinely considered-adjacent. Chroma was chosen because it ships with an
embedding-function abstraction and metadata filtering out of the box, so
`job_to_document()` / `job_to_metadata()` plug straight in without hand-writing
vector columns, `ivfflat`/`hnsw` index DDL, and cosine-distance SQL by hand. For
this project's size, either would work; Chroma was faster to integrate.

### Embeddings: why BGE-small, not OpenAI/Cohere?

`BAAI/bge-small-en-v1.5` via `sentence-transformers`, config in
`app/config.py:embedding_model`.

- **Free, runs locally** — no per-embedding API cost, no network call, no rate
  limit. Every job posting and every search query is embedded on the same
  machine that's already running the FastAPI process.
- **Small enough to load in-process** (~130MB) and run on CPU in milliseconds —
  no GPU required, though it auto-picks MPS (Apple Silicon) > CUDA > CPU if
  available (`_select_device()` in `embeddings.py`).
- **BGE models use an asymmetric query/document convention** — you prefix the
  *query* (not the documents) with `"Represent this sentence for searching
  relevant passages: "` before encoding. This is a known BGE-family trick that
  measurably improves retrieval quality for short queries against longer
  documents, and it's implemented exactly as BAAI recommends
  (`_BGE_QUERY_PREFIX` in `embeddings.py`).
- **Normalized embeddings + cosine similarity** — `normalize_embeddings=True`,
  Chroma collection metadata sets `"hnsw:space": "cosine"`. Cosine on normalized
  vectors is the standard, well-understood similarity metric for sentence
  embeddings (equivalent to dot product once normalized).

Why not a bigger/better embedding model (BGE-large, OpenAI `text-embedding-3`)?
Job postings here are short, template-structured text (title, company, skills,
salary — not paragraphs of prose), and the real quality lever turned out to be
the **hybrid reranking** on top of semantic search (see below), not a marginally
better embedding model. BGE-small was good enough that the effort went into
structuring the *documents* and *scoring* well instead.

### "How did you chunk, and how much?" — the honest answer: there is no chunking

This is worth stating plainly because it's a natural RAG question, and the
honest answer here is **"we don't chunk — and chunking would be the wrong tool
for this data."**

Chunking (splitting a long document into overlapping windows before embedding)
exists to solve one problem: a document is longer than what one embedding can
usefully represent (a PDF, a wiki page, a book chapter). **A job posting is not
that.** Each job posting becomes **exactly one embedded document** — see
`app/rag/documents.py:job_to_document()`. It builds a short, structured text
block per job:

```
Job Title: Backend Developer
Role: Backend Developer
Related Roles: backend developer | backend engineer | api developer
Category: backend
Company: Acme Pvt Ltd
Location: Kathmandu
Required Skills: Python, FastAPI, PostgreSQL, Docker
Technologies: Python, FastAPI, PostgreSQL, Docker
Salary: NPR 40,000 - 60,000
Source Portal: merojob
```

That's ~8-10 lines, well within a single embedding's useful context — splitting
it further would only throw away the cross-field context (e.g. "these skills
belong to this specific title/category") that makes retrieval accurate in the
first place. So: **1 job posting = 1 document = 1 embedding vector**, stored with
rich **metadata** (title, company, location, skills, salary, source, role
category) alongside it for filtering and reranking. No `RecursiveCharacterTextSplitter`,
no chunk-size/overlap tuning, because there's nothing long enough to need it.

(If this project later ingested long-form content — e.g. full job-description
PDFs with paragraphs of requirements — *that* would be where chunking becomes
necessary, with a chunk size around 300–500 tokens and ~10-15% overlap being the
standard starting point. It just isn't needed for the current data shape.)

### Retrieval: hybrid scoring, not pure semantic search

Pure vector similarity search has a known failure mode: it can rank a
"Frontend Developer" job highly for a "Backend Developer" query because the
*embedding* is close (both are "developer" roles), even though a human would
never call that a match. So `search_jobs()` (`app/rag/retriever.py`) does:

1. **Over-fetch** — pull `n * 4` candidates from Chroma (`job_search_overfetch: 4`),
   not just `n`, so there's a pool to rerank rather than committing to Chroma's
   raw top-k.
2. **Hybrid rerank** — combine 4 signals into one score:
   ```
   score = semantic_similarity
         + 0.22 * title_word_overlap        (job_search_title_boost)
         + 0.13 * skill_word_overlap        (job_search_skill_boost)
         + 0.10 * role_category_match       (job_search_category_boost)
   ```
   plus explicit penalties: a technical query matching a "general" category
   job with zero title/skill overlap gets **-0.12**; a Python/FastAPI query
   matching a PHP-titled job (no "python" in that title) gets **-0.15** — these
   are hand-tuned anti-false-positive rules born from actually looking at bad
   matches during development, not theoretical.
3. **Threshold, not top-k padding** — only candidates scoring **≥ 0.42**
   (`min_job_similarity`) are kept. If only 3 jobs clear the bar, you get 3
   results, never padded with irrelevant filler to hit a round number. This
   directly serves the project's "every claim must be backed by evidence"
   principle — no evidence, no result, rather than a weak result presented as
   if strong.

This is why the RAG layer is "hybrid search", a well-known real-world pattern
(used by e.g. Elasticsearch's `BM25 + kNN` combination), not vanilla top-k
cosine search.

---

## 3. OCR — why Mistral OCR, not PaddleOCR / Tesseract / EasyOCR?

Location: `app/services/cv_parser.py`.

The CV upload flow needs to turn a PDF resume into text, reliably, across
**wildly inconsistent formatting** — Nepali students' CVs range from clean
single-column Word exports to Canva templates with multi-column layouts, tables,
icons instead of labels, and scanned/photographed pages.

| Option | Why it wasn't chosen (or was, as a fallback) |
|---|---|
| **Tesseract** (open-source, classic OCR) | Character-level OCR only — no layout understanding. Multi-column CVs, tables, and icon-based section headers (common in modern CV templates) come out as scrambled, out-of-order text. Needs manual preprocessing (deskew, binarize) to be reliable. |
| **PaddleOCR / EasyOCR** (open-source, deep-learning OCR) | Better than Tesseract at raw text detection, but still fundamentally **text-detection** models — they find and read text boxes, they don't understand "this is an education table with 3 columns: degree, institution, year" as a structure. You'd still need a separate layout/structuring pass afterward. They also mean bundling a multi-hundred-MB model + a GPU-friendly inference stack into the deployment for a feature (resume parsing) that runs occasionally per user, not in a hot loop. |
| **Mistral OCR** (chosen, primary path) | Purpose-built as a **document** OCR — it returns **markdown**, preserving structure (headings, lists, table rows) rather than a flat text blob. That structure is exactly what the downstream LLM parsing step (Groq) needs to correctly separate "Experience" from "Education" from "Skills" sections even in a visually complex CV. It's an API call (no model to host/deploy), and it's already one of two Mistral products used in this project (alongside the interview LLM), so no new vendor relationship. |
| **pypdf** (`PdfReader.extract_text()`, used as merge/fallback) | Not OCR at all — it reads the PDF's embedded text layer directly (works only if the PDF has real text, not a scanned image). Fast, free, zero API call. Used **in addition to** Mistral OCR, not instead of it. |

**Why merge OCR + pypdf instead of picking one?** (`_merge_pdf_texts()`) — they
fail differently. Mistral OCR read from image glyphs, can occasionally
misread a table cell; pypdf reads the exact embedded text but returns nothing
useful for image-based/scanned PDFs and can jumble column order. Running both
and deduplicating identical paragraphs (`_merge_pdf_texts`) means whichever
method captured a given piece of text correctly is kept — pure addition, no
loss, and if Mistral's key is unset or the API call throws, the code degrades
to pypdf-only rather than failing (`extract_text()`'s `try/except`).

**What happens if OCR extracts too little?** `len(text.strip()) < 50` → HTTP 422
back to the student ("Could not extract enough text from the resume") — it
never silently proceeds to hallucinate a profile from near-nothing.

**After OCR**: the raw text (capped at `MAX_CV_CHARS = 12000` chars) goes to
Groq (`llama-3.1-8b-instant`) with a **strict-rules prompt** ("extract ONLY
what's explicitly present... NEVER invent") plus **regex-extracted hints**
(email/phone/name found via regex *before* the LLM call) that fill gaps the LLM
misses but never override what the LLM found. If the LLM call fails entirely
(`call_structured` returns `None` after a retry), the code falls back to
**regex-only fields** — degraded, but never invented.

---

## 4. LangGraph orchestrator — why a graph, not just function calls?

`app/orchestrator/graph.py`:

```
START → intake → gap → [route_after_gap] → roadmap? → save → END
```

- `intake` — no LLM, just loads the profile into a shared `CareerState` dict.
- `gap` — the 4-signal skill-gap merge (below) + optional narrative.
- `route_after_gap` — a **conditional edge**: if `run_roadmap=False`, skip
  straight to `save` (snapshot only, no roadmap generation wasted).
- `roadmap` — generates the week-by-week plan, only when actually needed.
- `save` — persists everything, no LLM.

**Why LangGraph instead of just calling these functions in sequence in Python?**
Honestly: for a linear pipeline like this one, a plain function pipeline would
work almost as well — this is the fair, defensible answer, not a
sales pitch. What LangGraph actually buys here:
- **Declared, inspectable state machine** — `CareerState` is a typed shared
  state that every node reads/writes explicitly, which makes the pipeline's
  data flow auditable (you can `.get_graph().draw_mermaid()` it) rather than
  implicit in a call chain.
- **The conditional edge is real branching logic**, not just an `if` buried in
  a function — `route_after_gap` is a first-class part of the graph definition,
  independently testable.
- **A single, independently-runnable reference implementation** —
  `uv run python -m app.orchestrator.run --profile-id <uuid>` runs the *exact*
  graph outside the API, useful for debugging/demos without curling FastAPI.
- **Room to grow** — if a future node needed to loop back (re-run gap after a
  new interview) or fan out (parallel roadmap variants), the graph shape
  already supports it; a hand-rolled function chain would need restructuring.

Two things it explicitly **isn't**: it isn't a multi-turn autonomous agent
(no node lets the LLM decide what to do next / call tools in a loop), and
`POST /api/gap` / `POST /api/roadmap` don't actually run through this graph in
production — they call the same underlying service functions directly, to avoid
re-running work across two already-tested endpoints. The graph is kept as the
"reference pipeline" (used by tests and the CLI runner), which is a documented,
deliberate non-duplication decision, not an oversight.

### Why this codebase's LLM features aren't "agents" in the tool-calling-loop sense

Every LLM feature in this project (interview, practice, roadmap, gap narrative,
learning curriculum) follows the **same shape**: gather context via plain
function calls first (some of them happen to be `@tool`-decorated LangChain
functions, callable individually), then make **one** structured-output LLM
call. Not a ReAct loop where the LLM repeatedly decides "call this tool, look
at the result, decide again."

**Why not a real agent loop?** Reliability and latency. A tool-calling loop adds
non-determinism (the LLM decides *when* to stop calling tools) and multiplies
API calls/latency for no benefit here — the context needed for e.g. "generate
this student's roadmap" is fully known upfront (their profile, their gap
report, the catalog). There's nothing to *discover* mid-generation that would
justify letting the model drive multiple round-trips. One well-grounded
prompt, one call, a strict Pydantic schema, a retry-once-then-deterministic-
fallback — that's a much smaller failure surface than an open-ended loop, which
matters a lot for a live user-facing feature.

---

## 5. Skill Gap — the "4-signal merge" (`app/services/skill_gap.py`)

The core idea: a skill only counts as **verified** if there's real evidence
for it, and the report says *which* evidence, always.

| Signal | Source | What it proves |
|---|---|---|
| 1. Claimed | `student_profiles.skills` | What the student *says* they have (weakest signal — self-reported) |
| 2. Market demand | Chroma `search_jobs(target_role)` | What Nepal employers actually ask for, right now |
| 3. Interview proof | Latest completed `interview_sessions` | Can the student *explain* the skill under adaptive questioning |
| 4. Practice proof | Latest completed `practice_sessions` | Did the student *pass* a timed, AI-graded coding/scenario challenge |

`compute_combined_skill_gap()` merges these deterministically — set
arithmetic and score thresholds, not an LLM decision. **The only LLM
involvement** is `generate_gap_narrative()`, and its prompt explicitly
constrains it to *explain numbers already computed* — it is structurally
prevented from inventing a skill, a job, or a score, because those are string-
interpolated into the prompt as already-final facts, not something the model
is asked to produce. This is the same "narrative wraps a deterministic
computation, never replaces it" pattern used everywhere numbers matter in this
project (gap size, readiness score, composite leaderboard score).

`classify_gap_size()`: `"large"` if `missing_skills + weak_skills >= 5`, else
`"small"` — this single threshold is computed exactly once (in the `gap` graph
node) and read everywhere else that needs to know roadmap depth, so the
large/small cutoff can't drift out of sync between the graph and the roadmap
service.

---

## 6. Skills catalog — why a fixed list, not free text or embedding-matched skills?

`app/services/skills_catalog.py` + `app/data/skills_catalog.json` — **41 roles,
440 role-skill entries (with overlap), 10 global skills, versioned**.

Every skill entering the system (CV parse, onboarding form, practice session,
skill gap, job matching, learning curriculum) is passed through
`normalize_skill()`, which resolves free text ("ReactJS", "React.js", "react")
to one canonical display name ("React") — or returns `None` if it's not in the
catalog, in which case it's **dropped**, never kept as untrusted free text.

**Why not just let students type anything?** Two skills meaning the same thing
but spelled differently would silently fail to match across the whole
pipeline — a student who typed "Node" would never match a job requiring
"Node.js", breaking the skill-gap comparison, job matching, and leaderboard
scoring simultaneously. A fixed catalog makes "same skill = same string"
guaranteed everywhere, which the 4-signal merge and job-matching scorer both
depend on structurally (they compare skill keys with plain set operations, not
fuzzy matching).

**Why not resolve skill synonyms via embedding similarity** (e.g. embed
"Node" and "Node.js" and check cosine distance) instead of a hand-maintained
alias table? Embedding similarity is *probabilistic* — "Node" and "Node.js"
would likely score close, but so might "React" and "Redux" (both React
ecosystem, semantically nearby), which would be a wrong match with real
consequences (a student "verified" in a skill they don't have). A fixed
alias/catalog is a **hard guarantee**, not a probability — worth the
maintenance cost of occasionally adding a new skill/alias in exchange for zero
false-equivalence risk in a system that makes verification claims about a
person.

---

## 7. Mock Interview & Skill Practice — how "verification" actually works

**Interview** (`app/services/interview.py`, `app/api/routes/interview.py`,
Mistral `mistral-small-latest` via `MISTRAL_API_KEY2`): adaptive turn-by-turn
Q&A. Each answer is evaluated **and** the next question chosen **in a single
LLM call** (`evaluate_with_next_question`) — not two calls — for latency. The
opening question is a **deterministic template** (`fallback_opening_question`),
not an LLM call, so the interview starts instantly instead of paying ~3-4s of
Mistral latency before the student sees anything.

**Practice** (`app/services/practice.py`, Groq `llama-3.1-8b-instant`): student
picks 1-3 skills, gets one challenge per skill (coding for tech roles,
scenario for non-tech), submits, gets scored against a **pass threshold of
7.0/10** (`practice_pass_threshold`). Score ≥ threshold → skill added to
`verified_strong_skills`; below → `verified_weak_skills`. These lists feed
directly into skill-gap signal 4.

**Difficulty is adaptive** in both — practice's next challenge difficulty is
derived from the score just given (`adapt_difficulty`), and the interview's
difficulty updates from `evaluation.suggested_difficulty` each turn. Challenges
are generated **lazily** (only the current one, not all upfront) so starting a
session doesn't fire N LLM calls before the student sees question 1.

---

## 8. Roadmap vs Learning Curriculum — two different features, easy to conflate

- **Roadmap** (`app/services/roadmap.py`) — a week-by-week (or skill-path
  phase/node) *schedule*, generated once from a skill-gap snapshot, sized by
  `gap_size`. Each task/node links out to **real external resources**
  (`learning_resources.build_resources_for_skill` — curated links + search
  deep-links, never an LLM-invented URL) that the student opens in a new tab;
  completion is tracked via a dwell-timer-then-confirm pattern
  (`useResourceStudyTracker` on the frontend).
- **Learning Curriculum** (`app/services/learning_agent.py`, its own DB table
  `learning_curricula`, Mistral `MISTRAL_API_KEY3`) — a **self-contained,
  in-app** set of lessons (explanation, steps, worked examples, mini
  self-checks), written directly by the LLM, with **no external links at
  all**. Completion comes from scrolling through the lesson in-app (a
  one-time confirm prompt) or a manual checkbox.

They intentionally solve different problems: the roadmap is "here's your
plan and where to go learn it"; the curriculum is "here's the lesson itself,
you never have to leave DISHA." A shared `max_tokens=16000` lesson
tuned this large curriculum call because the richer per-module content
(explanation + steps + examples + mini-checks × up to 9 modules) needs real
headroom — with it unset, Mistral's structured output silently truncated
mid-module, which is a genuinely useful "what broke and how was it found and
fixed" story if asked.

---

## 9. MCP — real docs and real web search for the Learning panel

`app/services/mcp_client.py` (336 lines), consumed by exactly one place:
`app/services/learning_resources.py`.

### What MCP actually is, in plain terms

MCP (Model Context Protocol) is an open standard, created by Anthropic, for
letting an app call outside tools through one common interface, instead of
writing separate custom integration code for every tool. Picture it like a USB
port for AI tools: any MCP-compatible tool server can plug into any
MCP-compatible app the same way, instead of a different one-off wire per
device. The app doesn't need to know each tool's private API shape in advance,
it asks the server "what tools do you have?" and gets a schema back.

### The two servers this project actually connects to

Both optional, both off by default (`settings.mcp_enabled = False`):

- **DuckDuckGo MCP server** — runs locally as a subprocess
  (`MCP_DUCKDUCKGO_COMMAND` + `MCP_DUCKDUCKGO_ARGS` in `.env`, in practice
  `uvx duckduckgo-mcp-server`). Used for real web search, specifically to find
  a real YouTube tutorial link for a skill the student needs to learn.
- **Context7 MCP server** — a hosted server (`MCP_CONTEXT7_URL`, plus an
  optional `MCP_CONTEXT7_API_KEY` to raise the free quota). Used to fetch real,
  current documentation for a library or framework, returned as markdown.

### Where this fits: one feature, three layers, in order

The Learning panel's resource list for a skill (`learning_resources.py`) is
built in this order:

1. **Curated catalog first** — hand-picked resources for that skill, tried
   always, whether or not MCP is enabled.
2. **Context7 real docs**, only if MCP is enabled (`fetch_library_docs`).
3. **DuckDuckGo real video search**, only if MCP is enabled and no video
   resource exists yet (`search_learning_web`).

If MCP is disabled, unreachable, slow, or a server's reply doesn't parse into
anything usable, every call in `mcp_client.py` resolves to an empty result
(`[]` or `None`) instead of raising — the Learning panel still works from the
curated catalog alone. This is the same "degrade, never break" rule used
everywhere an external/LLM call happens in this project (see `call_structured()`
in Section 13).

### How a call actually works (tool discovery, not a hardcoded API shape)

1. `_client()` builds one `MultiServerMCPClient` (from `langchain_mcp_adapters`)
   with both server connections, and is cached (`@lru_cache`) so it's built
   once per process.
2. `_tools_for(server_name)` asks that server "what tools do you have?"
   (`client.get_tools(...)`) and **caches the answer** — a tool's schema
   doesn't change mid-process, so only the first call per server pays for the
   subprocess spawn / handshake.
3. `_find_tool()` and `_match_arg_name()` then **fuzzy-match** the tool by name
   (e.g. anything with "search" in it) and its argument names (e.g. anything
   with "query" or "q" in it) instead of hardcoding "the DuckDuckGo tool is
   called X and takes a field called Y". Different MCP server implementations
   name things slightly differently, so this discovers the shape at runtime
   rather than assuming one fixed API.
4. `_invoke()` calls the tool with a timeout (`MCP_TIMEOUT_SECONDS`, default
   8s) so a slow server can never hang a request.
5. The DuckDuckGo result is parsed with a small cascade of pattern-matchers
   (`_parse_search_results`) because different servers return either
   structured JSON, markdown links, or a numbered plain-text list — cheap
   regexes handle all three rather than assuming one exact format.

### Why MCP instead of hand-writing a DuckDuckGo client and a Context7 client?

Honest answer: for just these two servers, a hand-written HTTP client for each
would work almost the same technically — this isn't being oversold. What MCP
actually buys here:

- **One client library talks to both**, over two different transports (a
  local subprocess for DuckDuckGo, streamable HTTP for Context7), instead of
  writing and maintaining two separate bespoke API clients.
- **Tool discovery instead of a hardcoded contract** — if a server changes its
  exact field names, this code doesn't necessarily need a code change, because
  it reads the schema at call time (see step 3 above) instead of assuming a
  fixed shape written once and forgotten.
- **New tools are a config change, not a rewrite** — swapping in a different
  MCP-compatible search or docs server later means changing a URL/command in
  `.env`, not touching `mcp_client.py`, because every MCP server speaks the
  same protocol.

### Why it's optional and off by default, not a core dependency

Two reasons. First, it depends on either running a local subprocess
(DuckDuckGo) or reaching an external hosted server with its own quota
(Context7) — one more moving part in a demo/dev environment that not every
reviewer's machine needs. Second, the curated resource catalog already gives
every skill a working set of learning resources on its own, so MCP is a pure
enhancement (fresher docs, a live video search) layered on top, never a single
point of failure the rest of the product depends on.

---

## 10. Multi-factor job matching (`app/services/job_matching.py`)

Three stages, not one similarity score:

1. **Retrieval** — Chroma hybrid search (same `search_jobs()` as the gap
   engine), min similarity **0.38**.
2. **Per-job composite scoring** across 8 weighted factors:

   | Factor | Weight |
   |---|---|
   | Skills overlap | 0.28 |
   | Role similarity | 0.22 |
   | Experience fit | 0.12 |
   | Seniority fit | 0.12 |
   | Domain alignment | 0.12 |
   | Education match | 0.06 |
   | Location | 0.04 |
   | Career-goal alignment | 0.04 |

3. **Hard floors, not just a sorted list** — a job must clear
   **role similarity ≥ 0.45**, **skill overlap ≥ 0.15**, **domain alignment ≥
   0.40**, and **composite ≥ 0.55** to appear at all (`job_match_min_*`
   settings). Plus explicit **role-conflict rules** — a hand-built table of
   ~15 adjacent-but-different role pairs (e.g. Backend ↔ Frontend, AI Engineer
   ↔ AI Instructor, Data Scientist ↔ Business Analyst) that actively
   *penalize* cross-matches, because pure keyword/embedding overlap
   consistently confused these in testing (a "Python Instructor" job kept
   surfacing for "Python Developer" searches — semantically close, wrong job).

This is the same philosophy as the RAG threshold: **fewer, correct, explainable
matches over a padded list of loosely-related ones.**

---

## 11. Database layer

- **Neon Postgres** (serverless Postgres) + **async SQLAlchemy 2.0** +
  **Alembic** migrations. Why Neon specifically: serverless/managed, free tier
  suitable for a student project, and branching/auto-suspend behavior that's
  fine for a low-traffic app — the trade-off (compute auto-suspends when idle,
  causing a cold-start on the next request) is handled explicitly by a
  **background keep-alive ping every 120s** (`_db_keepalive` in `main.py`)
  rather than ignored.
- **Connection pool tuned deliberately, not left default**: `pool_pre_ping`
  is **off** (would add a ~0.5-1s round-trip *per checkout* over Neon's
  long-haul link, just to validate a connection that's almost always fine) —
  that validation cost is paid instead by the keep-alive background task, off
  the request path. `pool_recycle=1800`. Pool size bumped from a smaller
  default after observing the dashboard alone fires 4 parallel requests per
  load (React StrictMode can double that in dev), which was regularly
  spilling into disposable overflow connections.
- **9 tables**: `users`, `student_profiles`, `roadmaps`, `learning_curricula`,
  `interview_sessions`/`interview_turns`, `practice_sessions`/
  `practice_challenges`, `skill_gap_snapshots`, `scrape_runs`.

---

## 12. Scraper — where the "live Nepal job market" data actually comes from

`scraper/scraper.py` — **7 source adapters**: `kamkhoj` (an aggregator that
already re-publishes postings from many boards), plus 6 direct-portal scrapers
(`merojob`, `kumarijob`, `jobaxle`, `jobsnepal`, `jobejee`, `merorojgari`).

Three run **modes**:
- `aggregator` — kamkhoj only (fast, broad volume).
- `direct` — all 6 individual portals (slower, more requests, sometimes
  richer per-posting detail).
- `hybrid` — kamkhoj (volume) + merojob/kumarijob (used to enrich
  skills/salary fields), deduped by keeping the more complete record per
  original URL when the same posting appears from two sources.

Current corpus: **396 jobs**, fully ingested into Chroma (`396` vectors,
matching exactly). Each scrape run is logged to `scrape_runs` with per-source
completeness stats (`source_stats()` — % of postings with skills detected, %
with real salary, % with a specific location) so source quality is measured,
not assumed.

### Commercial use and scraping risk, the honest answer

This is the one question that deserves a fully honest answer, not a
confident-sounding dodge: scraping a website's HTML to build a commercial
product carries real legal risk, and that risk does not disappear just
because the data is publicly visible on the page.

What is actually already done to reduce it:

- **robots.txt is checked, not ignored.** Kamkhoj's robots.txt explicitly
  allows HTML pages and disallows `/api/` and `/_next/` — this scraper only
  touches the allowed paths (see the comment directly above `_scrape_kamkhoj`
  in `scraper/scraper.py`).
- **LinkedIn is deliberately excluded**, specifically because of its Terms of
  Service (`README.md`: "No LinkedIn scraping (ToS)."). This is a real
  decision already made, not an oversight, the highest-risk source was cut
  before it became a problem.
- **Rate-limited, not aggressive.** Requests are capped
  (`asyncio.Semaphore(5)` per source), with pacing delays between pages, so
  this behaves like a slow, polite crawler, not a bot hammering a server.
- **Only metadata is kept, never the full posting.** A job in this system is
  a title, company, location, a short skills list, and a salary range, never
  the full job description text (`data/jobs.json` has no `description` field
  at all). The actual posting content stays on the source site.
- **Every job links back to its original posting** (`source_url`), and the
  frontend's "View" button opens that link in a new tab (`JobMatchCard.jsx`).
  A student can never apply without visiting the real posting, this system
  behaves closer to a search/meta-search layer (like Google Jobs, or a flight
  meta-search site) than a copy of the job board.

What this does **not** resolve, said plainly: robots.txt and a Terms of
Service are two different things. A site's robots.txt can allow crawling for
indexing while its ToS still prohibits automated scraping for building a
separate product, and merojob/kumarijob's ToS likely does exactly that, the
same as most job boards'. Following robots.txt reduces "we didn't even try to
be respectful" risk, it does not by itself make scraping these two sites for
a commercial product contractually safe.

Honest path if this goes from hackathon project to a real commercial
product:

1. **Ask first.** Reach out to merojob, kumarijob, and kamkhoj for an
   official data-sharing or API partnership before commercial launch, this is
   how most job aggregators (Indeed, Google Jobs) eventually operate, even if
   they started by crawling.
2. **Lean on employers posting directly.** As real students and companies
   use DISHA AI, first-party job postings (typed in by employers themselves)
   can gradually replace scraped ones as the primary source.
3. **Keep the link-out model permanently.** Never host the full posting or
   let a student apply without visiting the source, this is both the safer
   legal posture and good etiquette toward the sites the data comes from.
4. **Get real legal advice before commercial launch.** This document can
   explain the engineering decisions honestly, it cannot substitute for a
   lawyer reviewing Nepal's specific electronic transaction and copyright law
   against merojob/kumarijob's actual current Terms of Service.

---

## 13. Anticipated defense questions — quick answers

**Q: Why Chroma and not Qdrant/Pinecone/Weaviate/Milvus?**
Corpus is ~400 documents; those tools are built for a scaled, separately-run
vector search *service* over much larger corpora. Chroma embeds directly in
the FastAPI process with zero extra infra — the right tool at this scale. It's
an honest scaling trade-off, not a technical limitation being hidden.

**Q: What's your chunk size / chunking strategy?**
There isn't one — each job posting is short and structured enough to be one
embedded document (`job_to_document()`), so chunking (built for splitting
long documents) doesn't apply. Chunking would be introduced only if long-form
documents (e.g. full PDFs) were ever ingested.

**Q: Why BGE-small and not OpenAI embeddings?**
Free, local, no API cost/latency/rate-limit per embed, small enough to run on
CPU in milliseconds, and BGE's asymmetric query-prefix trick is implemented
per BAAI's own recommendation. Quality gains here came from hybrid reranking,
not a bigger embedding model.

**Q: Why Mistral OCR and not PaddleOCR/Tesseract?**
Those are text-detection models with no document-structure understanding;
Mistral OCR returns markdown that preserves headings/tables/lists, which the
downstream LLM structuring step needs to correctly separate CV sections. Also
merged with pypdf's raw-text-layer extraction as a belt-and-suspenders
fallback — never OCR alone.

**Q: Why two LLM vendors (Groq + Mistral)?**
Different model characteristics for different jobs — Groq's small model is
fast/cheap and fine for CV structuring/grading, but was found (empirically) to
intermittently emit malformed tool calls under the interview's more complex
structured schema; Mistral is steadier there.

**Q: Why LangGraph if it's not a real autonomous agent?**
It gives an inspectable, testable state machine for the one genuinely branching
pipeline (gap → maybe-roadmap → save), plus an independently-runnable
reference implementation — not because every feature needed a graph.

**Q: How do you stop the LLM from hallucinating skills, jobs, or scores?**
Structurally, not by asking nicely: (1) fixed skills catalog — anything not
recognized is dropped; (2) narrative-generation prompts interpolate
already-computed numbers as facts to explain, never ask the model to produce
them; (3) resource URLs on the roadmap come from a curated/deterministic
lookup, never the LLM; (4) every structured LLM call has a strict Pydantic
schema plus a deterministic fallback if it fails twice.

**Q: What happens when an LLM call fails?**
`call_structured()` retries once (covers both a raised exception and a clean
`None`/no-tool-call response), then returns `None`; every caller has a
deterministic, clearly-labeled fallback (a template CV, a generic lesson
module, a plain-computed gap narrative) — the user never sees a raw 500 from
an LLM hiccup.

**Q: Why a fixed skills catalog instead of free text?**
Guarantees "same skill = same string" everywhere skills are compared (gap
merge, job matching, leaderboard), which those systems depend on via plain set
operations — free text or embedding-similarity matching would introduce silent
mismatches or false-equivalences in a system that makes verification claims
about real people.

**Q: Why Neon Postgres?**
Serverless/managed Postgres, free tier fits a student project; its
auto-suspend-when-idle behavior is handled explicitly with a background
keep-alive ping rather than left as an unaddressed cold-start problem.

**Q: What is MCP and why do you use it?**
MCP (Model Context Protocol) is an open standard for letting an app call
outside tools through one common interface instead of a custom integration per
tool. We use it for two optional, off-by-default tools that enrich the Learning
panel only: a DuckDuckGo web-search server (real YouTube tutorial links) and a
Context7 docs server (real, current library documentation).

**Q: What happens if the MCP servers are down or MCP is disabled?**
Nothing breaks. Every MCP call is wrapped so a disabled setting, an
unreachable server, a timeout, or an unparsable reply all resolve to an empty
result, and the Learning panel simply falls back to its curated resource
catalog, which already works with MCP off.

**Q: Is it legal to scrape merojob/kumarijob/kamkhoj, especially for a
commercial product?**
Not fully resolved, said honestly rather than hidden. What's already in
place: robots.txt is checked and respected (not ignored), LinkedIn was
deliberately excluded for its ToS, requests are rate-limited, only short
metadata is stored (never the full posting text), and every job links back
to the original posting so the source site gets the click, not a copy. That
said, robots.txt allowing crawling and a site's Terms of Service are two
different things, and this project's current scraping would need either an
official partnership with these portals or a lawyer's review of Nepal's
electronic transaction law before a real commercial launch, this is a
prototype-stage practice, not a resolved legal position. Full breakdown in
Section 12.
