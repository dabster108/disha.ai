"""Multi-factor job matching for student profiles.

Stage 1: Chroma hybrid retrieval (role-relevant candidates).
Stage 2: Per-job scoring across skills, role, experience, seniority,
         domain, education, location, and career-goal alignment.
Stage 3: Hard thresholds — return fewer, highly relevant jobs only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.config import get_settings
from app.rag.documents import (
    _detect_domains,
    _tokenize,
    infer_role_category,
    title_overlap_score,
)
from app.rag.retriever import search_jobs
from app.services.skill_gap import (
    GapContext,
    merge_interview_signals,
    merge_practice_signals,
    normalize_skill_name,
    skills_match,
)

# ---------------------------------------------------------------------------
# Generic keywords — low discriminative power; must not inflate scores alone
# ---------------------------------------------------------------------------

_GENERIC_KEYWORDS = frozenset({
    "ai", "ml", "manager", "engineer", "developer", "analyst", "executive",
    "officer", "assistant", "specialist", "consultant", "coordinator", "lead",
    "senior", "junior", "intern", "associate", "general", "technical",
})

# ---------------------------------------------------------------------------
# Role conflict pairs — adjacent but different roles
# ---------------------------------------------------------------------------

_ROLE_CONFLICT_RULES: list[tuple[tuple[str, ...], tuple[str, ...], float]] = [
    (("backend", "back-end", "api developer", "server-side"), ("frontend", "front-end", "ui developer", "react developer"), 0.40),
    (("frontend", "front-end", "ui developer", "react"), ("backend", "back-end", "api developer", "php developer"), 0.40),
    (("ai engineer", "machine learning engineer", "ml engineer"), ("instructor", "teacher", "lecturer", "trainer", "tutor"), 0.45),
    (("ai instructor", "teacher", "lecturer"), ("software engineer", "developer", "ml engineer"), 0.35),
    (("data scientist", "data science"), ("business analyst", "business analysis"), 0.35),
    (("business analyst",), ("data scientist", "machine learning"), 0.30),
    (("product manager", "product owner"), ("project manager", "project coordinator", "pmo"), 0.40),
    (("project manager", "project coordinator"), ("product manager", "product owner"), 0.40),
    (("accountant", "accounts officer"), ("financial analyst", "investment analyst"), 0.35),
    (("financial analyst",), ("accountant", "accounts officer", "tally"), 0.30),
    (("marketing", "brand", "digital marketing"), ("sales executive", "sales officer", "business development"), 0.30),
    (("sales", "business development"), ("marketing executive", "marketing officer", "brand"), 0.30),
    (("nurse", "nursing", "staff nurse"), ("doctor", "physician", "medical officer"), 0.35),
    (("hr", "human resource", "recruitment"), ("sales", "business development"), 0.25),
    (("devops", "sre", "platform engineer"), ("frontend", "ui developer"), 0.30),
    (("qa", "quality assurance", "tester"), ("backend developer", "full stack"), 0.20),
]

_SENIORITY_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\b(internship|intern)\b", re.I), 0),
    (re.compile(r"\b(fresher|fresh graduate|entry[\s-]?level|graduate trainee)\b", re.I), 1),
    (re.compile(r"\b(junior|jr\.?)\b", re.I), 1),
    (re.compile(r"\b(mid[\s-]?level|intermediate)\b", re.I), 2),
    (re.compile(r"\b(senior|sr\.?)\b", re.I), 3),
    (re.compile(r"\b(lead|principal|staff)\b", re.I), 4),
    (re.compile(r"\b(manager|head of)\b", re.I), 5),
    (re.compile(r"\b(director|vp|vice president|chief)\b", re.I), 6),
]

_SENIORITY_YEARS = {0: 0.0, 1: 1.0, 2: 3.5, 3: 6.0, 4: 8.0, 5: 10.0, 6: 14.0}

_EDUCATION_KEYWORDS = (
    "bca", "bcom", "bba", "bcd", "mba", "bsc", "btech", "be ", "b.e.", "mca",
    "bph", "bn", "pcl", "ca", "acca", "cma", "bit", "csit", "engineering",
)


@dataclass
class JobMatchFactors:
    skills_match: float
    role_similarity: float
    experience_match: float
    seniority_match: float
    domain_match: float
    education_match: float
    location_match: float
    career_goal_alignment: float

    def composite(self, weights: dict[str, float]) -> float:
        return (
            weights["skills"] * self.skills_match
            + weights["role"] * self.role_similarity
            + weights["experience"] * self.experience_match
            + weights["seniority"] * self.seniority_match
            + weights["domain"] * self.domain_match
            + weights["education"] * self.education_match
            + weights["location"] * self.location_match
            + weights["career_goal"] * self.career_goal_alignment
        )


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    lowered = text.casefold()
    return any(term.casefold() in lowered for term in terms)


def _role_conflict_penalty(target_role: str, job_title: str) -> float:
    penalty = 0.0
    title_lower = job_title.casefold()
    for target_terms, job_terms, p in _ROLE_CONFLICT_RULES:
        if _contains_any(target_role, target_terms) and _contains_any(job_title, job_terms):
            if ("full stack" in title_lower or "fullstack" in title_lower) and p >= 0.35:
                continue
            penalty = max(penalty, p)
    return penalty


def _discriminative_tokens(text: str) -> set[str]:
    return {t for t in _tokenize(text) if t not in _GENERIC_KEYWORDS}


def _infer_seniority(text: str) -> int:
    for pattern, level in _SENIORITY_PATTERNS:
        if pattern.search(text):
            return level
    if re.search(r"\b(officer|executive|developer|engineer|analyst|nurse|teacher)\b", text, re.I):
        return 2
    return 2


def _seniority_match(student_years: float | None, job_seniority: int) -> float:
    if student_years is None:
        return 0.45 if job_seniority >= 5 else 0.70
    expected = _SENIORITY_YEARS.get(job_seniority, 3.5)
    diff = abs(student_years - expected)
    if diff <= 1.0:
        return 1.0
    if diff <= 2.5:
        return 0.75
    if diff <= 4.0:
        return 0.50
    if student_years < expected - 4:
        return 0.15
    if student_years > expected + 6:
        return 0.55
    return 0.30


def _experience_match(student_years: float | None, job_title: str, job_skills: list[str]) -> float:
    blob = f"{job_title} {' '.join(job_skills)}"
    m = re.search(r"\b(\d+)\+?\s*years?\s*(of\s+)?experience\b", blob, re.I)
    if m:
        required = float(m.group(1))
        if student_years is None:
            return 0.60
        if student_years >= required:
            return 1.0
        return max(0.1, 1.0 - (required - student_years) * 0.2)
    if student_years is None:
        return 0.65
    if _infer_seniority(job_title) <= 1 and student_years <= 2:
        return 0.95
    return 0.80


def _location_match(student_location: str | None, job_location: str | None) -> float:
    if not student_location or not job_location:
        return 0.60
    s = student_location.casefold()
    j = job_location.casefold()
    if s in j or j in s:
        return 1.0
    city_groups = {
        "kathmandu": ("ktm", "kathmandu valley", "lalitpur", "patan", "bhaktapur"),
        "pokhara": ("pokhara",),
        "biratnagar": ("biratnagar",),
    }
    for city, aliases in city_groups.items():
        if city in s or any(a in s for a in aliases):
            if city in j or any(a in j for a in aliases):
                return 0.95
    if "nepal" in s and "nepal" in j:
        return 0.70
    if "remote" in j or "work from home" in j:
        return 0.85
    return 0.25


def _domain_match(target_role: str, job_title: str, job_skills: list[str], job_category: str) -> float:
    target_domains = _detect_domains(target_role, [])
    job_domains = _detect_domains(job_title, job_skills)
    if not target_domains:
        target_cat = infer_role_category(target_role, [])
        if target_cat != "general":
            target_domains = {target_cat}
    if not job_domains and job_category != "general":
        job_domains = {job_category}
    if not target_domains or not job_domains:
        return 0.50
    overlap = target_domains & job_domains
    if overlap:
        return min(1.0, 0.65 + 0.35 * (len(overlap) / max(len(target_domains), 1)))
    related = {
        "finance": {"banking", "business"},
        "banking": {"finance", "business"},
        "marketing": {"sales", "business"},
        "sales": {"marketing", "business"},
        "nursing": {"healthcare"},
        "healthcare": {"nursing"},
        "backend": {"fullstack", "software", "devops"},
        "frontend": {"fullstack", "software", "design"},
        "ml_ai": {"data", "backend"},
        "data": {"ml_ai", "backend"},
    }
    for td in target_domains:
        if job_domains & related.get(td, set()):
            return 0.45
    return 0.10


def _education_match(education: list, job_title: str, job_skills: list[str]) -> float:
    if not education:
        return 0.55
    edu_blob = " ".join(
        str(item) if not isinstance(item, dict) else " ".join(str(v) for v in item.values())
        for item in education
    ).casefold()
    job_blob = f"{job_title} {' '.join(job_skills)}".casefold()
    student_edu = {kw for kw in _EDUCATION_KEYWORDS if kw in edu_blob}
    job_edu = {kw for kw in _EDUCATION_KEYWORDS if kw in job_blob}
    if not job_edu:
        return 0.65
    if not student_edu:
        return 0.40
    overlap = student_edu & job_edu
    if overlap:
        return min(1.0, 0.60 + 0.40 * len(overlap) / len(job_edu))
    return 0.25


def _career_goal_alignment(target_role: str, job_title: str) -> float:
    target_disc = _discriminative_tokens(target_role)
    title_disc = _discriminative_tokens(job_title)
    if not target_disc:
        return title_overlap_score(target_role, job_title)
    overlap = target_disc & title_disc
    if not overlap:
        return 0.10
    if all(t in _GENERIC_KEYWORDS for t in overlap):
        return 0.20
    return min(1.0, len(overlap) / len(target_disc))


def _skills_analysis(
    job_skills: list[str],
    claimed_skills: list[str],
    strong_keys: set[str],
    weak_keys: set[str],
) -> tuple[float, list[str], list[str], list[str], list[str]]:
    if not job_skills:
        return 0.50, [], [], [], []

    claimed_map = {normalize_skill_name(s): s for s in claimed_skills}
    matched: list[str] = []
    missing: list[str] = []
    positives: list[str] = []
    negatives: list[str] = []

    for skill in job_skills:
        key = normalize_skill_name(skill)
        if not key:
            continue
        found = False
        for ckey, display in claimed_map.items():
            if skills_match(key, ckey) or key in ckey or ckey in key:
                matched.append(display)
                found = True
                break
        if not found:
            missing.append(skill.strip())

    ratio = len(matched) / len(job_skills)
    for m in matched[:6]:
        mkey = normalize_skill_name(m)
        positives.append(f"Verified {m}" if mkey in strong_keys else f"+ {m}")
    for m in missing[:6]:
        mkey = normalize_skill_name(m)
        negatives.append(f"Tested weak in {m}" if mkey in weak_keys else f"Missing {m}")

    return ratio, matched, missing, positives, negatives


def _adjusted_role_similarity(
    base_similarity: float,
    target_role: str,
    job_title: str,
    job_skills: list[str],
) -> float:
    score = base_similarity
    target_disc = _discriminative_tokens(target_role)
    title_disc = _discriminative_tokens(job_title)
    skill_disc = _discriminative_tokens(" ".join(job_skills))
    job_disc = title_disc | skill_disc

    if target_disc:
        disc_overlap = len(target_disc & job_disc) / len(target_disc)
        if disc_overlap < 0.15:
            score *= 0.55
        elif disc_overlap < 0.30:
            score *= 0.75
        else:
            score = min(1.0, score * (0.85 + 0.15 * disc_overlap))

    score -= _role_conflict_penalty(target_role, job_title)
    return round(max(0.0, min(1.0, score)), 4)


def _compute_factors(
    job: dict,
    ctx: GapContext,
) -> tuple[JobMatchFactors, list[str], list[str], list[str], list[str]]:
    profile = ctx.profile
    interview = merge_interview_signals(ctx.interview)
    practice = merge_practice_signals(ctx.practice)
    strong_keys = {s["key"] for s in interview["strong_skills"] + practice["strong_skills"]}
    weak_keys = {s["key"] for s in interview["weak_skills"] + practice["weak_skills"]}
    claimed = [s.strip() for s in (profile.skills or []) if s and s.strip()]
    job_skills = job.get("required_skills") or []
    job_title = job.get("title") or ""
    job_category = job.get("role_category") or "general"

    skills_ratio, matched, missing, positives, negatives = _skills_analysis(
        job_skills, claimed, strong_keys, weak_keys
    )
    role_sim = _adjusted_role_similarity(
        job.get("similarity") or job.get("semantic_similarity") or 0.0,
        profile.target_role,
        job_title,
        job_skills,
    )
    seniority = _infer_seniority(job_title)
    factors = JobMatchFactors(
        skills_match=round(skills_ratio, 4),
        role_similarity=role_sim,
        experience_match=round(_experience_match(profile.years_of_experience, job_title, job_skills), 4),
        seniority_match=round(_seniority_match(profile.years_of_experience, seniority), 4),
        domain_match=round(_domain_match(profile.target_role, job_title, job_skills, job_category), 4),
        education_match=round(_education_match(profile.education or [], job_title, job_skills), 4),
        location_match=round(_location_match(profile.location, job.get("location")), 4),
        career_goal_alignment=round(_career_goal_alignment(profile.target_role, job_title), 4),
    )
    return factors, matched, missing, positives, negatives


def match_label(score_pct: int) -> str:
    if score_pct >= 90:
        return "Exceptional Match"
    if score_pct >= 75:
        return "Strong Match"
    if score_pct >= 60:
        return "Moderate Match"
    return "Weak Match"


def _calibrate_display_score(raw: float, factors: JobMatchFactors) -> int:
    """Compress scores so 100% is extremely rare."""
    compressed = raw**1.12
    pct = int(round(compressed * 94))
    high_factors = [
        factors.skills_match,
        factors.role_similarity,
        factors.domain_match,
        factors.seniority_match,
    ]
    all_high = all(f >= 0.85 for f in high_factors)
    if pct >= 95 and not all_high:
        pct = min(pct, 91)
    if pct >= 100:
        pct = 99
    return max(0, min(99, pct))


def _passes_thresholds(factors: JobMatchFactors, composite: float, settings) -> bool:
    if factors.role_similarity < settings.job_match_min_role_similarity:
        return False
    if factors.skills_match < settings.job_match_min_skill_overlap:
        return False
    if factors.domain_match < settings.job_match_min_domain_alignment:
        return False
    if composite < settings.job_match_min_composite:
        return False
    if factors.seniority_match < 0.20:
        return False
    return True


def score_job(job: dict, ctx: GapContext) -> dict:
    settings = get_settings()
    weights = {
        "skills": settings.job_match_skills_weight,
        "role": settings.job_match_role_weight,
        "experience": settings.job_match_experience_weight,
        "seniority": settings.job_match_seniority_weight,
        "domain": settings.job_match_domain_weight,
        "education": settings.job_match_education_weight,
        "location": settings.job_match_location_weight,
        "career_goal": settings.job_match_career_goal_weight,
    }

    factors, matched_skills, missing_skills, positives, negatives = _compute_factors(job, ctx)
    composite = round(factors.composite(weights), 4)
    score_pct = _calibrate_display_score(composite, factors)

    return {
        "id": job.get("id"),
        "title": job.get("title"),
        "company": job.get("company"),
        "location": job.get("location"),
        "required_skills": job.get("required_skills") or [],
        "salary_range": job.get("salary_range"),
        "source_url": job.get("source_url"),
        "role_category": job.get("role_category"),
        "match_score": score_pct,
        "match_label": match_label(score_pct),
        "composite_score": composite,
        "factors": {
            "skills_match": factors.skills_match,
            "role_similarity": factors.role_similarity,
            "experience_match": factors.experience_match,
            "seniority_match": factors.seniority_match,
            "domain_match": factors.domain_match,
            "education_match": factors.education_match,
            "location_match": factors.location_match,
            "career_goal_alignment": factors.career_goal_alignment,
        },
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "explanation": {
            "positives": positives,
            "negatives": negatives,
        },
        "passes_thresholds": _passes_thresholds(factors, composite, settings),
    }


def rank_jobs_for_student(ctx: GapContext, *, n: int | None = None) -> list[dict]:
    """Retrieve candidates then rank with multi-factor scoring."""
    settings = get_settings()
    max_results = n if n is not None else settings.job_match_max_results
    fetch_n = max(max_results * settings.job_search_overfetch, 30)

    candidates = search_jobs(
        ctx.profile.target_role,
        n=fetch_n,
        min_similarity=settings.job_match_retrieval_min_similarity,
    )

    scored = [score_job(job, ctx) for job in candidates]
    qualified = [row for row in scored if row["passes_thresholds"]]
    qualified.sort(key=lambda row: (row["composite_score"], row["match_score"]), reverse=True)

    return qualified[:max_results]
