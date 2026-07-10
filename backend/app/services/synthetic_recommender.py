"""Synthetic Recommendation Lab — content-based scoring against a public,
generic benchmark dataset (``datasets/Job Datsset.csv``: 500 unique jobs,
100k user-job rows, a fixed 10-skill vocabulary). This is a demo/benchmark
path only — it is a completely separate corpus from the live, real Nepal
job postings used by ``POST /api/jobs/match`` (job_matching.py + Chroma),
and never touches that pipeline.

Ground-truth note: this CSV's ``Match_Score``/``Recommended`` columns have
~zero correlation with actual skill overlap between ``User_Skills`` and
``Job_Requirements`` (measured Pearson r ~ -0.02 on a 2,000-row sample, and
mean Jaccard overlap is nearly identical between Recommended=1 and
Recommended=0 rows — ~0.21 vs ~0.22). They appear to be randomly assigned
rather than derived from the skill text. ``evaluate()`` reports this
directly rather than implying a real content-based scorer "should" agree
with these labels.
"""

from __future__ import annotations

import csv
import random
from dataclasses import dataclass, field
from functools import lru_cache

from app.config import get_settings
from app.services.skill_gap import normalize_skill_name
from app.services.skill_overlap import overlap

GROUND_TRUTH_NOTE = (
    "This dataset's Match_Score/Recommended labels do not correlate with actual "
    "skill overlap (~0 Pearson correlation measured) — treat eval numbers as a "
    "demonstration of that mismatch, not an accuracy benchmark for our scorer."
)


def _skills_from_text(text: str) -> set[str]:
    return {normalize_skill_name(s) for s in (text or "").split(",") if s.strip()}


@dataclass
class SyntheticJob:
    job_id: str
    requirements_text: str
    requirements_skills: set[str]
    match_scores: list[float] = field(default_factory=list)
    recommended_count: int = 0
    row_count: int = 0

    @property
    def avg_match_score(self) -> float | None:
        return sum(self.match_scores) / len(self.match_scores) if self.match_scores else None

    @property
    def max_match_score(self) -> float | None:
        return max(self.match_scores) if self.match_scores else None

    @property
    def any_recommended(self) -> bool:
        return self.recommended_count > 0


@dataclass
class _Dataset:
    jobs: dict[str, SyntheticJob]
    rows: list[tuple[set[str], str, float, int]]  # (user_skills, job_id, match_score, recommended)


@lru_cache
def _load_dataset() -> _Dataset:
    settings = get_settings()
    path = settings.synthetic_dataset_file
    if not path.exists():
        raise FileNotFoundError(f"Synthetic dataset not found at {path}")

    jobs: dict[str, SyntheticJob] = {}
    rows: list[tuple[set[str], str, float, int]] = []

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            job_id = row["Job_ID"].strip()
            requirements_text = row["Job_Requirements"].strip()
            match_score = float(row["Match_Score"])
            recommended = int(row["Recommended"])

            job = jobs.get(job_id)
            if job is None:
                job = SyntheticJob(
                    job_id=job_id,
                    requirements_text=requirements_text,
                    requirements_skills=_skills_from_text(requirements_text),
                )
                jobs[job_id] = job
            job.match_scores.append(match_score)
            job.recommended_count += recommended
            job.row_count += 1

            user_skills = _skills_from_text(row["User_Skills"])
            rows.append((user_skills, job_id, match_score, recommended))

    return _Dataset(jobs=jobs, rows=rows)


def _score(user_skills: set[str], job: SyntheticJob) -> tuple[float, list[str], list[str]]:
    return overlap(user_skills, job.requirements_skills)


def recommend(skills: list[str], *, top_k: int = 10) -> dict:
    clean_skills = [s.strip() for s in (skills or []) if s and s.strip()]
    if not clean_skills:
        return {"matches": [], "reason": "no_skills"}

    dataset = _load_dataset()
    user_skills = {normalize_skill_name(s) for s in clean_skills}

    scored = []
    for job in dataset.jobs.values():
        our_score, matched, missing = _score(user_skills, job)
        scored.append(
            {
                "job_id": job.job_id,
                "job_requirements": job.requirements_text,
                "our_score": round(our_score, 4),
                "dataset_match_score": round(job.avg_match_score, 4) if job.avg_match_score is not None else None,
                "dataset_recommended": job.any_recommended,
                "matched_skills": matched,
                "missing_skills": missing,
                "explanation": (
                    f"{len(matched)}/{len(job.requirements_skills)} required skills matched"
                    if job.requirements_skills
                    else "Job has no listed requirements"
                ),
            }
        )

    scored.sort(key=lambda row: row["our_score"], reverse=True)
    return {"matches": scored[:top_k], "reason": None}


def evaluate(*, sample_n: int = 500, seed: int = 42) -> dict:
    """Sample sample_n rows, compare our content score vs this dataset's own
    Match_Score (MAE) and Recommended flag, and report the ground-truth
    mismatch plainly (see GROUND_TRUTH_NOTE).

    Note on "precision@k": each of the 100k rows is a distinct user_id with
    exactly one job rated — there's no per-user ranked job list to compute a
    true ranking precision@k against. What's reported instead is precision
    of a simple our_score >= 0.5 classifier against the Recommended=1 rows,
    which is the closest well-defined analog given this data's shape.
    """
    dataset = _load_dataset()
    rng = random.Random(seed)
    sample_size = min(sample_n, len(dataset.rows))
    sample = rng.sample(dataset.rows, sample_size)

    abs_errors = []
    hits = 0
    total_precision_rows = 0
    for user_skills, job_id, dataset_score, recommended in sample:
        job = dataset.jobs[job_id]
        our_score, _, _ = _score(user_skills, job)
        abs_errors.append(abs(our_score - dataset_score))
        if recommended:
            total_precision_rows += 1
            if our_score >= 0.5:
                hits += 1

    mae = sum(abs_errors) / len(abs_errors) if abs_errors else None
    precision_at_threshold = (hits / total_precision_rows) if total_precision_rows else None

    return {
        "sample_size": sample_size,
        "mae": round(mae, 4) if mae is not None else None,
        "precision_when_recommended": round(precision_at_threshold, 4) if precision_at_threshold is not None else None,
        "note": GROUND_TRUTH_NOTE,
    }
