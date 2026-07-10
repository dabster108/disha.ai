# Backend audit notes

Read-only review of services, RAG, and API routes, followed by targeted fixes.
No breaking changes to working endpoints — everything below was either a bug
(fixed), a consistency gap (fixed), or a deliberate simplification (documented,
not silently dropped).

## Fixed

**Interview session 500 on the very first answer** (`app/api/routes/interview.py`).
`POST /api/interview/answer` created the next `InterviewTurn` with `session_id=session.id`
(a bare FK column) instead of the ORM relationship. Because `async_session_factory`
uses `expire_on_commit=False`, the already-loaded `session.turns` collection never
picked up the new turn, so the post-commit re-fetch returned the same stale list —
the handler's own `next()` calls then found nothing and raised its documented 500
("no next question is available"). Fixed by attaching via `next_turn.session = session`
and dropping the now-redundant re-fetch (same root cause and fix as a prior bug in
`practice.py`'s submit handler — both now use the relationship-attach pattern).

**Interview LLM reliability.** Even after the above fix, session summaries were
silently falling back to generic template text. Root cause: Groq's small model
intermittently returns a malformed tool call under structured output with several
fields (a `groq.BadRequestError: tool_use_failed`) — first seen in `practice.py`,
now confirmed in `interview.py` too. Moved interview's question generation,
evaluation, and summary to `ChatMistralAI` on a separate key (`MISTRAL_API_KEY2`,
distinct quota from the OCR key), and extracted the retry-then-fallback logic
both services already needed into one place: `app/services/llm_utils.py::call_structured()`
(retries once, returns `None` on repeated failure so the caller's existing
template fallback still applies). `practice.py` was refactored to call the same
helper instead of keeping its own copy.

**`cv_parser.parse_cv()` had no retry or fallback** — the one LLM call site in the
codebase that didn't yet use `call_structured()`. Given the same provider flakiness
above, a bad Groq response would 500 `POST /api/profile/upload-resume` instead of
degrading. Now goes through `call_structured()`; on failure it returns an empty
`ParsedCV()` rather than a guessed one — this endpoint's contract is "no invented
skills," so an empty result the student fills in by hand is the correct fallback,
not a fabricated one.

**`InterviewTurn` was missing its own `__table_args__`.** The unique constraint
`uq_interview_turns_session_turn_index` exists in the live DB (from an earlier
hand-written migration) but was never declared on the SQLAlchemy model. Every
`alembic revision --autogenerate` since has proposed dropping it as a false
positive, which had to be manually stripped from two unrelated migrations this
session. Added the missing `__table_args__` declaration; a follow-up dry
autogenerate now produces an empty diff, confirming model and DB agree.

## Simplified (documented, not silent)

**LangGraph `route_after_gap`** — the originally sketched topology had
`full_roadmap` and `compact_roadmap` as separate conditional-edge outcomes, but
both pointed at the identical `roadmap` node. That's not a branch, just two names
for one destination. Collapsed to a single `"roadmap"` outcome; the large/small
distinction still exists as `gap_size` (computed once in `gap_node` via
`classify_gap_size()`) and is read by `roadmap_node` to decide plan depth (~8
weeks vs. ~4 weeks + interview-prep) — one source of truth for the threshold
instead of two places that would need to agree on `missing + weak >= 5`.

## Reviewed, left unchanged

- **`app/rag/retriever.py` / `documents.py`** — hybrid scoring (semantic + title/skill/category
  overlap), over-fetch-then-filter, and the domain-alias/exclusive-group logic for
  role disambiguation are already solid and were not touched; `compute_market_gap()`
  reuses `search_jobs()` rather than re-querying Chroma.
- **`compute_market_gap()` / `compute_skill_gap()` market logic** — extended (skill
  normalization now runs through `normalize_skill_name`/alias map), not rewritten;
  the original matched/missing/match_ratio/sample_jobs shape is unchanged for
  backward compatibility with `POST /api/gap/market`.
- **`app/api/routes/voice.py`** — already had correct 503-on-external-failure /
  422-on-empty-input handling; no changes needed.
- **CORS config** (`app/main.py`) — left as-is (localhost only), per instructions.
- **`print()` instead of `logging`** in `cv_parser.extract_text`'s OCR-fallback path —
  cosmetic inconsistency with newer modules' `logging.getLogger(...)`, not a
  correctness issue; left as a minor known nit rather than churning an unrelated file.
- **MCP server** (`app/mcp/server.py`, official Python MCP SDK) — the task marked
  this optional ("if time permits"). Skipped in favor of finishing the required
  LangChain `@tool` wrappers (`app/orchestrator/tools/`) properly and testing the
  full LangGraph pipeline end-to-end. The tools already wrap the single
  implementation of job search / profile / assessment lookups, so an MCP layer
  later is a thin pass-through, not a rewrite.
- **`selectinload` usage** — `interview.py` and `practice.py` routes already used
  it correctly for turn/challenge history (no N+1); `roadmap.py` and `gap.py`
  routes only ever fetch single rows or flat lists, so no relationship loading
  was needed there either.
