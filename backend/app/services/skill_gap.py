"""Unified skill gap agent: merges 4 signals into one student-facing report.

    1. CLAIMED SKILLS  — student_profiles.skills (what the student says they have)
    2. MARKET DEMAND   — Chroma search_jobs(target_role) (what Nepal employers want)
    3. INTERVIEW PROOF — latest completed interview_sessions/turns (adaptive Q&A)
    4. PRACTICE PROOF  — latest completed practice_sessions (per-skill pass/fail)

compute_market_gap() is deterministic and signal-1-vs-2 only (kept for
backward compatibility with /api/gap/market and the orchestrator fallback).
compute_combined_skill_gap() merges all four; only the narrative step touches
an LLM, and only to explain numbers this module already computed — it never
invents skills, jobs, or scores.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.models import InterviewSession, PracticeSession, SkillGapSnapshot, StudentProfile
from app.rag.documents import infer_role_category, is_technical_role
from app.rag.retriever import search_jobs
from app.services.llm_utils import call_structured
from app.services.skills_catalog import normalize_skill as catalog_normalize_skill

# --------------------------------------------------------------------------
# Skill name normalization
# --------------------------------------------------------------------------

_SKILL_ALIASES: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "vue.js": "vue",
    "nodejs": "node.js",
    "node": "node.js",
    "postgres": "postgresql",
    "psql": "postgresql",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "k8s": "kubernetes",
    "restful api": "rest api",
    "restful apis": "rest api",
    "rest apis": "rest api",
    "nextjs": "next.js",
    "next": "next.js",
}


def normalize_skill_name(skill: str) -> str:
    """Casefold + collapse whitespace + resolve common aliases for matching.

    Prefers the canonical skills-catalog name when the skill is known there
    (so a claimed CV skill and a scraped job skill that both mean "React"
    converge on the same key). Anything outside the catalog — most real
    scraped-job skill text, which is far broader than the curated catalog —
    still normalizes via the local alias map below, exactly as before.
    """
    catalog_hit = catalog_normalize_skill(skill)
    if catalog_hit:
        return catalog_hit.casefold()
    key = re.sub(r"\s+", " ", (skill or "").strip().casefold()).rstrip(".")
    return _SKILL_ALIASES.get(key, key)


def skills_match(a: str, b: str) -> bool:
    return normalize_skill_name(a) == normalize_skill_name(b)


def compute_profile_evidence(profile: StudentProfile) -> dict:
    """Skills implied by profile_meta (structured skill levels + project tech
    stacks) — the single evidence source reused by roadmap path seeding and,
    here, surfaced in gap_data so the roadmap LLM prompt can see it too."""
    meta = profile.profile_meta or {}

    skill_levels: dict[str, str] = {}
    for entry in meta.get("skills") or []:
        name = (entry or {}).get("name")
        level = (entry or {}).get("level")
        if name and level:
            skill_levels[normalize_skill_name(name)] = str(level).strip().casefold()

    project_skills: set[str] = set()
    for project in meta.get("projects") or []:
        for tech in (project or {}).get("technologies") or []:
            if tech:
                project_skills.add(normalize_skill_name(tech))

    return {"skill_levels": skill_levels, "project_skills": sorted(project_skills)}


# --------------------------------------------------------------------------
# Signal 1 + 2 — claimed skills vs market demand (deterministic, no LLM)
# --------------------------------------------------------------------------


# role_category values whose skills belong in a software-developer's market
# demand. Deliberately EXCLUDES "design" (graphic/UI → Photoshop/Illustrator)
# and "product" (PM → non-technical) — those aren't software-engineering roles,
# so their skills are noise for a Backend/Frontend/Data student's gap even
# though the retriever still treats them as broadly "tech" for ranking.
_TECH_ROLE_CATEGORIES = frozenset({
    "backend", "frontend", "fullstack", "software", "tech", "ml_ai", "data",
    "devops", "mobile", "qa",
})

# Generic soft skills / non-technical domain skills that pollute market demand
# for an IT student — they come from sales/marketing/admin postings that leak
# into retrieval. Dropped from demand ONLY when the target role is technical.
# This is a noise stoplist, not a new skill taxonomy. Normalized to match the
# keys _demand_from_jobs builds.
_SOFT_SKILL_NOISE = frozenset(
    normalize_skill_name(s)
    for s in (
        "communication", "communication skills", "teamwork", "leadership",
        "negotiation", "coordination", "time management", "multitasking",
        "presentation", "interpersonal skills", "strong interpersonal skills",
        "relationship-building skills", "problem solving", "management",
        "team management", "work under pressure", "attention to detail",
        "customer service", "documentation", "documentation and reporting",
        "reporting", "seo", "digital marketing", "sales", "sales and marketing",
        "marketing", "branding", "business development", "accounting",
        "ms office suite", "excel", "autocad", "crm software",
    )
)


def _demand_from_jobs(
    jobs: list[dict], *, tech_only: bool = False, drop_soft_skills: bool = False
) -> dict[str, dict]:
    """Aggregate required-skill demand across a list of job postings.

    For a technical target role, ``tech_only`` skips postings whose
    role_category is non-technical (their skills are noise for an IT student)
    and ``drop_soft_skills`` filters generic soft-skill entries — so
    priority_learn/market_missing surface real IT skills, not
    hygiene/cooking/sales terms.
    """
    demand: dict[str, dict] = {}
    for job in jobs:
        if tech_only and job.get("role_category") not in _TECH_ROLE_CATEGORIES:
            continue
        for skill in job["required_skills"]:
            key = normalize_skill_name(skill)
            if not key:
                continue
            if drop_soft_skills and key in _SOFT_SKILL_NOISE:
                continue
            entry = demand.setdefault(key, {"skill": skill.strip(), "jobs_requiring": 0})
            entry["jobs_requiring"] += 1
    return demand


def _demand_flags(target_role: str | None) -> tuple[bool, bool]:
    """(tech_only, drop_soft_skills) for demand aggregation, gated on the target
    role being technical and the corresponding config toggles."""
    settings = get_settings()
    tech_role = is_technical_role(target_role)
    return (
        tech_role and settings.gap_tech_demand_tech_jobs_only,
        tech_role and settings.gap_tech_demand_drop_soft_skills,
    )


def _market_demand(
    student_skills: list[str], target_role: str, n_jobs: int
) -> tuple[list[dict], dict[str, dict], set[str]]:
    """One Chroma query, reused by both compute_market_gap and the combined agent."""
    jobs = search_jobs(target_role, n=n_jobs)
    tech_only, drop_soft = _demand_flags(target_role)
    demand = _demand_from_jobs(jobs, tech_only=tech_only, drop_soft_skills=drop_soft)
    student_keys = {normalize_skill_name(s) for s in student_skills}
    return jobs, demand, student_keys


def compute_market_gap(
    student_skills: list[str],
    target_role: str,
    *,
    n_jobs: int = 15,
) -> dict:
    jobs, demand, student_keys = _market_demand(student_skills, target_role, n_jobs)

    matched = [entry for key, entry in demand.items() if key in student_keys]
    missing = [entry for key, entry in demand.items() if key not in student_keys]
    matched.sort(key=lambda entry: entry["jobs_requiring"], reverse=True)
    missing.sort(key=lambda entry: entry["jobs_requiring"], reverse=True)

    return {
        "target_role": target_role,
        "jobs_analyzed": len(jobs),
        "matched_skills": matched,
        "missing_skills": missing,
        "match_ratio": round(len(matched) / max(len(demand), 1), 2),
        "sample_jobs": [
            {
                "title": job["title"],
                "company": job["company"],
                "location": job["location"],
                "source_url": job["source_url"],
                "similarity": job["similarity"],
            }
            for job in jobs[:5]
        ],
    }


# Backward-compatible alias — this was the original public function name.
compute_skill_gap = compute_market_gap


# --------------------------------------------------------------------------
# Signal 3 + 4 — interview and practice merge (pure functions, no DB/LLM)
# --------------------------------------------------------------------------


def merge_interview_signals(interview: InterviewSession | None) -> dict:
    """Per interview merge rules: skill_tag score<5 -> weak, score>=7 -> strong."""
    if interview is None:
        return {
            "overall_score": None,
            "strengths": [],
            "weaknesses": [],
            "summary": None,
            "strong_skills": [],
            "weak_skills": [],
        }

    strong: dict[str, dict] = {}
    weak: dict[str, dict] = {}
    for turn in interview.turns:
        if not turn.skill_tag or turn.score is None:
            continue
        key = normalize_skill_name(turn.skill_tag)
        if turn.score >= 7:
            strong[key] = {"key": key, "skill": turn.skill_tag, "score": turn.score}
        elif turn.score < 5:
            weak[key] = {"key": key, "skill": turn.skill_tag, "score": turn.score}

    return {
        "overall_score": interview.overall_score,
        "strengths": interview.strengths or [],
        "weaknesses": interview.weaknesses or [],
        "summary": interview.summary,
        "strong_skills": list(strong.values()),
        "weak_skills": list(weak.values()),
    }


def merge_practice_signals(practice: PracticeSession | None) -> dict:
    """Per practice merge rules: verified_strong/weak_skills come straight from the session."""
    if practice is None:
        return {
            "overall_score": None,
            "summary": None,
            "strong_skills": [],
            "weak_skills": [],
            "pass_rate": None,
        }

    skill_scores = practice.skill_scores or {}
    strong = [
        {"key": normalize_skill_name(skill), "skill": skill, "score": skill_scores.get(skill)}
        for skill in (practice.verified_strong_skills or [])
    ]
    weak = [
        {"key": normalize_skill_name(skill), "skill": skill, "score": skill_scores.get(skill)}
        for skill in (practice.verified_weak_skills or [])
    ]
    challenges = practice.challenges or []
    answered = [c for c in challenges if c.score is not None]
    pass_rate = (sum(1 for c in answered if c.passed) / len(answered)) if answered else None

    return {
        "overall_score": practice.overall_score,
        "summary": practice.summary,
        "strong_skills": strong,
        "weak_skills": weak,
        "pass_rate": pass_rate,
    }


# --------------------------------------------------------------------------
# GapContext — loads profile + latest interview/practice for a profile
# --------------------------------------------------------------------------


@dataclass
class GapContext:
    profile: StudentProfile
    interview: InterviewSession | None
    practice: PracticeSession | None
    n_jobs: int


async def load_gap_context(
    db: AsyncSession,
    profile_id: uuid.UUID,
    *,
    interview_session_id: uuid.UUID | None = None,
    practice_session_id: uuid.UUID | None = None,
    n_jobs: int = 20,
) -> GapContext | None:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        return None

    if interview_session_id is not None:
        interview = await db.get(
            InterviewSession, interview_session_id, options=[selectinload(InterviewSession.turns)]
        )
    else:
        result = await db.execute(
            select(InterviewSession)
            .options(selectinload(InterviewSession.turns))
            .where(InterviewSession.profile_id == profile_id, InterviewSession.status == "completed")
            .order_by(InterviewSession.started_at.desc())
            .limit(1)
        )
        interview = result.scalar_one_or_none()

    if practice_session_id is not None:
        practice = await db.get(
            PracticeSession, practice_session_id, options=[selectinload(PracticeSession.challenges)]
        )
    else:
        result = await db.execute(
            select(PracticeSession)
            .options(selectinload(PracticeSession.challenges))
            .where(PracticeSession.profile_id == profile_id, PracticeSession.status == "completed")
            .order_by(PracticeSession.started_at.desc())
            .limit(1)
        )
        practice = result.scalar_one_or_none()

    return GapContext(profile=profile, interview=interview, practice=practice, n_jobs=n_jobs)


# --------------------------------------------------------------------------
# Priority score (MVP formula — documented here, the only place it's computed)
# --------------------------------------------------------------------------
#
#   priority = 0
#     + min(jobs_requiring, 4) * 10   # market weight, capped at 40
#     + 20 if verified_weak            # proved weak — urgent
#     + 15 if market_missing           # employers want it, not on CV
#     + 10 if overclaimed              # CV says yes, proof says no
#     - 15 if verified_strong          # already proven — lower priority
#     - 10 if matched and not weak     # already have + market wants, no red flag
#   clamped to [0, 100]


def _confidence(*, market_backed: bool, verified: bool) -> str:
    """Trust level for a skill claim.

    high   = employers want it AND we tested it (interview/practice proof)
    medium = market-backed only, or test-proven only
    low    = self-claimed on CV, no market or test evidence yet
    """
    if market_backed and verified:
        return "high"
    if market_backed or verified:
        return "medium"
    return "low"


def _priority_score(
    *, jobs_requiring: int, is_weak: bool, is_market_missing: bool, is_overclaimed: bool, is_strong: bool, is_matched: bool
) -> int:
    score = min(jobs_requiring, 4) * 10
    if is_weak:
        score += 20
    if is_market_missing:
        score += 15
    if is_overclaimed:
        score += 10
    if is_strong:
        score -= 15
    if is_matched and not is_weak:
        score -= 10
    return max(0, min(100, score))


def _priority_reason(*, jobs_requiring: int, is_weak: bool, is_market_missing: bool, is_overclaimed: bool, source: str | None) -> str:
    parts: list[str] = []
    if is_market_missing:
        plural = "s" if jobs_requiring != 1 else ""
        parts.append(f"{jobs_requiring} Nepal job{plural} require it; not on CV")
    if is_overclaimed:
        parts.append(f"claimed on CV but scored weak in {source or 'testing'}")
    elif is_weak:
        parts.append(f"tested weak in {source or 'testing'}")
    if not parts:
        parts.append("market demand")
    return "; ".join(parts)


# --------------------------------------------------------------------------
# The combined agent
# --------------------------------------------------------------------------


def compute_combined_skill_gap(ctx: GapContext) -> dict:
    profile = ctx.profile
    settings = get_settings()
    claimed_skills = [s.strip() for s in (profile.skills or []) if s and s.strip()]
    claimed_keys = {normalize_skill_name(s) for s in claimed_skills}

    # ONE Chroma search per report. The pool (lower retrieval threshold, larger
    # n) is reused for both market-demand aggregation and the ranked job matches
    # below — instead of the two separate searches this module used to run.
    pool_n = max(ctx.n_jobs, settings.job_match_max_results * settings.job_search_overfetch, 32)
    job_pool = search_jobs(
        profile.target_role,
        n=pool_n,
        min_similarity=settings.job_match_retrieval_min_similarity,
    )
    demand_jobs = [j for j in job_pool if j["similarity"] >= settings.min_job_similarity][: ctx.n_jobs]
    jobs = demand_jobs
    tech_only, drop_soft = _demand_flags(profile.target_role)
    demand = _demand_from_jobs(demand_jobs, tech_only=tech_only, drop_soft_skills=drop_soft)

    interview_signals = merge_interview_signals(ctx.interview)
    practice_signals = merge_practice_signals(ctx.practice)

    # Practice is a dedicated skill test — prefer it over interview signal when
    # both cover the same skill. Weak always overrides strong for the same skill:
    # a single bad showing on a claimed skill is worth flagging even if another
    # signal rated it well.
    weak_by_skill: dict[str, dict] = {}
    strong_by_skill: dict[str, dict] = {}
    for item in interview_signals["strong_skills"]:
        strong_by_skill[item["key"]] = {**item, "source": "interview"}
    for item in interview_signals["weak_skills"]:
        weak_by_skill[item["key"]] = {**item, "source": "interview"}
    for item in practice_signals["strong_skills"]:
        strong_by_skill[item["key"]] = {**item, "source": "practice"}
    for item in practice_signals["weak_skills"]:
        weak_by_skill[item["key"]] = {**item, "source": "practice"}
    for key in list(strong_by_skill):
        if key in weak_by_skill:
            del strong_by_skill[key]

    all_keys = set(demand) | claimed_keys | set(weak_by_skill) | set(strong_by_skill)

    def display_name(key: str) -> str:
        if key in demand:
            return demand[key]["skill"]
        if key in weak_by_skill:
            return weak_by_skill[key]["skill"]
        if key in strong_by_skill:
            return strong_by_skill[key]["skill"]
        for skill in claimed_skills:
            if normalize_skill_name(skill) == key:
                return skill
        return key

    matched_skills: list[dict] = []
    market_missing_skills: list[dict] = []
    verified_strong_skills: list[dict] = []
    verified_weak_skills: list[dict] = []
    overclaimed_skills: list[dict] = []
    claimed_unverified_skills: list[dict] = []
    priority_rows: list[dict] = []

    for key in all_keys:
        skill_name = display_name(key)
        jobs_requiring = demand.get(key, {}).get("jobs_requiring", 0)
        is_claimed = key in claimed_keys
        is_weak = key in weak_by_skill
        is_strong = key in strong_by_skill
        is_market_missing = jobs_requiring > 0 and not is_claimed
        is_matched = jobs_requiring > 0 and is_claimed
        is_overclaimed = is_claimed and is_weak

        verified = is_strong or is_weak

        if is_matched:
            matched_skills.append(
                {
                    "skill": skill_name,
                    "jobs_requiring": jobs_requiring,
                    "status": "matched",
                    "market_backed": True,
                    "verified": verified,
                    "confidence": _confidence(market_backed=True, verified=verified),
                }
            )

        priority = _priority_score(
            jobs_requiring=jobs_requiring,
            is_weak=is_weak,
            is_market_missing=is_market_missing,
            is_overclaimed=is_overclaimed,
            is_strong=is_strong,
            is_matched=is_matched,
        )

        if is_market_missing:
            market_missing_skills.append(
                {
                    "skill": skill_name,
                    "jobs_requiring": jobs_requiring,
                    "priority_score": priority,
                    "market_backed": True,
                    "confidence": _confidence(market_backed=True, verified=False),
                }
            )

        if is_strong:
            entry = strong_by_skill[key]
            verified_strong_skills.append({"skill": skill_name, "source": entry["source"], "score": entry["score"]})
        if is_weak:
            entry = weak_by_skill[key]
            verified_weak_skills.append({"skill": skill_name, "source": entry["source"], "score": entry["score"]})

        if is_overclaimed:
            entry = weak_by_skill[key]
            overclaimed_skills.append(
                {
                    "skill": skill_name,
                    "claimed": True,
                    "score": entry["score"],
                    "source": entry["source"],
                    "reason": f"on CV but scored weak in {entry['source']} ({entry['score']})",
                }
            )
        elif is_claimed and not is_weak and not is_strong:
            claimed_unverified_skills.append({"skill": skill_name, "reason": "on CV, not tested yet"})

        if priority > 0:
            source = (weak_by_skill.get(key) or {}).get("source")
            priority_rows.append(
                {
                    "skill": skill_name,
                    "priority_score": priority,
                    "jobs_requiring": jobs_requiring,
                    "market_backed": jobs_requiring > 0,
                    "verified": verified,
                    "confidence": _confidence(market_backed=jobs_requiring > 0, verified=verified),
                    "reason": _priority_reason(
                        jobs_requiring=jobs_requiring,
                        is_weak=is_weak,
                        is_market_missing=is_market_missing,
                        is_overclaimed=is_overclaimed,
                        source=source,
                    ),
                }
            )

    matched_skills.sort(key=lambda e: e["jobs_requiring"], reverse=True)
    market_missing_skills.sort(key=lambda e: e["priority_score"], reverse=True)
    verified_strong_skills.sort(key=lambda e: e["score"] or 0, reverse=True)
    verified_weak_skills.sort(key=lambda e: e["score"] or 0)
    priority_rows.sort(key=lambda e: e["priority_score"], reverse=True)
    priority_learn = priority_rows[:10]

    match_ratio = round(len(matched_skills) / max(len(demand), 1), 2)

    interview_component = (interview_signals["overall_score"] / 10) if interview_signals["overall_score"] is not None else 0.5
    practice_component = practice_signals["pass_rate"] if practice_signals["pass_rate"] is not None else 0.5
    readiness_score = round(
        100
        * (
            0.4 * match_ratio
            + 0.3 * (len(verified_strong_skills) / max(len(claimed_skills), 1))
            + 0.2 * interview_component
            + 0.1 * practice_component
        )
    )
    readiness_score = max(0, min(100, readiness_score))

    interview_insights = None
    if ctx.interview is not None:
        interview_insights = {
            "overall_score": interview_signals["overall_score"],
            "strengths": interview_signals["strengths"],
            "weaknesses": interview_signals["weaknesses"],
        }

    priority_skill_names = [row["skill"] for row in priority_learn[:5]]
    from app.services.job_matching import rank_jobs_for_student, score_job

    # Reuse the pool retrieved above — no second Chroma search.
    ranked_jobs = rank_jobs_for_student(ctx, prefetched=job_pool)

    # Role & technical differentiation — surfaces job_matching.py's role-conflict
    # logic (e.g. backend != frontend, AI engineer != instructor) so the student
    # can see *why* adjacent-but-different postings weren't counted as matches,
    # instead of match_score alone quietly excluding them.
    role_category = infer_role_category(profile.target_role, claimed_skills)
    all_scored = [score_job(j, ctx) for j in job_pool]
    role_mismatched = [
        row
        for row in all_scored
        if not row["passes_thresholds"]
        and row["factors"]["role_similarity"] < settings.job_match_min_role_similarity
    ]
    role_mismatched.sort(key=lambda r: r["factors"]["role_similarity"])
    differentiation_examples = [
        {
            "title": row["title"],
            "role_similarity": row["factors"]["role_similarity"],
            "domain_match": row["factors"]["domain_match"],
            "reason": (
                f"Adjacent title but low role fit ({round(row['factors']['role_similarity'] * 100)}%) "
                f"for {profile.target_role} — not counted as a match."
            ),
        }
        for row in role_mismatched[:3]
    ]
    qualified_role_sims = [row["factors"]["role_similarity"] for row in ranked_jobs] or [0.0]
    qualified_domain_matches = [row["factors"]["domain_match"] for row in ranked_jobs] or [0.0]
    role_fit = {
        "target_role": profile.target_role,
        "role_category": role_category,
        "jobs_considered": len(job_pool),
        "jobs_qualified": len(ranked_jobs),
        "excluded_for_role_mismatch": len(role_mismatched),
        "avg_role_similarity": round(sum(qualified_role_sims) / len(qualified_role_sims), 2),
        "avg_domain_match": round(sum(qualified_domain_matches) / len(qualified_domain_matches), 2),
        "differentiation_examples": differentiation_examples,
    }

    has_interview = ctx.interview is not None
    has_practice = ctx.practice is not None
    verified_count = len(verified_strong_skills) + len(verified_weak_skills)
    proof_signals = sum([has_interview, has_practice])
    if proof_signals >= 2 and verified_count > 0:
        accuracy_level = "High"
    elif proof_signals >= 1 and verified_count > 0:
        accuracy_level = "Medium"
    else:
        accuracy_level = "Low"

    evidence = {
        "accuracy_level": accuracy_level,
        "signals": {
            "cv_claimed": {
                "present": len(claimed_skills) > 0,
                "count": len(claimed_skills),
                "label": "CV / claimed skills",
            },
            "market": {
                "present": len(jobs) > 0,
                "jobs_analyzed": len(jobs),
                "skills_in_demand": len(demand),
                "label": "Live Nepal job postings (Chroma)",
            },
            "interview": {
                "present": has_interview,
                "overall_score": interview_signals["overall_score"],
                "verified_skills": len(interview_signals["strong_skills"]) + len(interview_signals["weak_skills"]),
                "label": "Mock interview proof",
            },
            "practice": {
                "present": has_practice,
                "pass_rate": practice_signals["pass_rate"],
                "verified_skills": len(practice_signals["strong_skills"]) + len(practice_signals["weak_skills"]),
                "label": "Skill practice proof",
            },
        },
        "confidence_legend": {
            "high": "Employers want it AND you proved it in a test",
            "medium": "Market-backed only, or test-proven only",
            "low": "Self-claimed on CV, not yet verified",
        },
        "checklist": [
            {
                "key": "interview",
                "label": "Complete a mock interview",
                "done": has_interview,
                "href": "/mock-interview",
                "impact": "Verifies claimed skills with adaptive Q&A",
            },
            {
                "key": "practice",
                "label": "Complete a practice session",
                "done": has_practice,
                "href": "/practice",
                "impact": "Pass/fail tests each skill individually",
            },
        ],
    }

    return {
        "target_role": profile.target_role,
        "jobs_analyzed": len(jobs),
        "match_ratio": match_ratio,
        "readiness_score": readiness_score,
        "evidence": evidence,
        "role_fit": role_fit,
        "sources_used": {
            "profile": True,
            "market": True,
            "interview_session_id": str(ctx.interview.id) if ctx.interview else None,
            "practice_session_id": str(ctx.practice.id) if ctx.practice else None,
        },
        "claimed_skills": claimed_skills,
        "profile_evidence": compute_profile_evidence(profile),
        "matched_skills": matched_skills,
        "market_missing_skills": market_missing_skills,
        "verified_strong_skills": verified_strong_skills,
        "verified_weak_skills": verified_weak_skills,
        "overclaimed_skills": overclaimed_skills,
        "claimed_unverified_skills": claimed_unverified_skills,
        "interview_insights": interview_insights,
        "priority_learn": priority_learn,
        "sample_jobs": [
            {
                "title": job["title"],
                "company": job["company"],
                "location": job.get("location"),
                "source_url": job["source_url"],
                "similarity": job.get("composite_score", 0),
                "match_score": job["match_score"],
                "match_label": job["match_label"],
                "matched_skills": job.get("matched_skills", []),
                "missing_skills": job.get("missing_skills", []),
                "relaxed_match": job.get("relaxed_match", False),
                "explanation": job.get("explanation"),
                "role_similarity": job.get("factors", {}).get("role_similarity"),
                "domain_match": job.get("factors", {}).get("domain_match"),
            }
            for job in ranked_jobs
        ],
        "roadmap_inputs": {
            "target_role": profile.target_role,
            "priority_skills": priority_skill_names,
            "time_per_week": profile.time_per_week,
            "budget": profile.budget,
            "readiness_score": readiness_score,
            "estimated_weeks": len(priority_skill_names) * 2,
        },
    }


# --------------------------------------------------------------------------
# Groq narrative — explains the computed gap_data, never invents new facts
# --------------------------------------------------------------------------


class GapNarrative(BaseModel):
    narrative: str = Field(
        description=(
            "3-5 sentences in English plus one short encouraging line in Nepali "
            "(Roman or Devanagari) at the end. Under 120 words total. Grounded "
            "ONLY in the provided gap data — never invent skills, jobs, or numbers."
        )
    )


def _fallback_narrative(gap_data: dict, profile: StudentProfile) -> str:
    readiness = gap_data.get("readiness_score", 0)
    top = [row["skill"] for row in gap_data.get("priority_learn", [])[:3]]
    strong = [e["skill"] for e in gap_data.get("verified_strong_skills", [])[:1]] or [
        e["skill"] for e in gap_data.get("matched_skills", [])[:1]
    ]
    parts = [f"You're at {readiness}% readiness for the {profile.target_role} role in Nepal's job market."]
    if top:
        parts.append(f"Focus next on {', '.join(top)} to close the biggest gaps.")
    if strong:
        parts.append(f"Keep leveraging your strength in {strong[0]}.")
    parts.append("अभ्यास जारी राख्नुहोस्, तपाईं सफल हुनुहुनेछ!")
    return " ".join(parts)


def slim_gap_for_llm(gap_data: dict) -> dict:
    """Trim gap JSON for LLM prompts — keeps signal, drops bulk (sample job bodies, etc.)."""
    sample_jobs = gap_data.get("sample_jobs") or []
    return {
        "readiness_score": gap_data.get("readiness_score"),
        "match_ratio": gap_data.get("match_ratio"),
        "jobs_analyzed": gap_data.get("jobs_analyzed"),
        "priority_learn": (gap_data.get("priority_learn") or [])[:5],
        "market_missing_skills": (gap_data.get("market_missing_skills") or [])[:5],
        "verified_strong_skills": (gap_data.get("verified_strong_skills") or [])[:3],
        "verified_weak_skills": (gap_data.get("verified_weak_skills") or [])[:3],
        "matched_skills": (gap_data.get("matched_skills") or [])[:5],
        "sample_jobs": [
            {"title": j.get("title"), "company": j.get("company")}
            for j in sample_jobs[:3]
            if isinstance(j, dict)
        ],
    }


async def generate_gap_narrative(gap_data: dict, profile: StudentProfile) -> str:
    slim = slim_gap_for_llm(gap_data)
    prompt = (
        "You are Disha, a career counselor for Nepali students.\n"
        "Explain the student's skill gap based ONLY on the JSON data provided.\n"
        "Do not invent skills, jobs, or statistics not in the data.\n"
        "Structure:\n"
        "1. One sentence on overall readiness (use readiness_score).\n"
        "2. Top 3 skills to learn first (from priority_learn) with brief why.\n"
        "3. One strength to leverage (verified_strong or matched).\n"
        "4. One line in Nepali (Roman or Devanagari) encouraging the student.\n"
        "Keep under 120 words. Mention Nepal job market context when sample_jobs exist.\n"
        "Include 1-2 real job titles from sample_jobs if provided.\n\n"
        f"Gap data JSON:\n{json.dumps(slim, ensure_ascii=False)}"
    )
    settings = get_settings()
    llm = ChatGroq(model=settings.groq_model, temperature=0.3, api_key=settings.groq_api_key)
    result = await call_structured(llm, GapNarrative, prompt)
    return result.narrative if result is not None else _fallback_narrative(gap_data, profile)


async def get_or_create_current_snapshot(db: AsyncSession, profile: StudentProfile) -> SkillGapSnapshot:
    """Reuse the latest skill-gap snapshot for this profile if it was computed
    for the student's *current* target_role; otherwise compute and persist a
    fresh one.

    Without this check, switching goals (target_role) would leave roadmap and
    curriculum generation silently planning against gap data for the role the
    student just switched away from — right role name in the prompt, wrong
    skill-gap analysis underneath it.
    """
    result = await db.execute(
        select(SkillGapSnapshot)
        .where(SkillGapSnapshot.profile_id == profile.id)
        .order_by(SkillGapSnapshot.created_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if snapshot is not None and snapshot.target_role == profile.target_role:
        return snapshot

    ctx = await load_gap_context(db, profile.id, n_jobs=get_settings().gap_n_jobs)
    gap_data = compute_combined_skill_gap(ctx)
    snapshot = SkillGapSnapshot(
        profile_id=profile.id,
        target_role=profile.target_role,
        interview_session_id=ctx.interview.id if ctx.interview else None,
        practice_session_id=ctx.practice.id if ctx.practice else None,
        jobs_analyzed=gap_data["jobs_analyzed"],
        match_ratio=gap_data["match_ratio"],
        gap_data=gap_data,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
