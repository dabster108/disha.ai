"""Shared skill-overlap primitives.

Used by the Synthetic Recommendation Lab (app/services/synthetic_recommender.py,
generic benchmark data) so its scoring math has one home. Live Nepal job
matching (app/services/job_matching.py) already computes matched/missing
skills and a match ratio in its own `_skills_analysis`, verified against real
postings and covered by tests/test_job_matching.py — that response shape
(match_score, matched_skills, missing_skills, explanation) is the same shape
this module produces, so both surfaces are explainable the same way without
the higher-risk of rewriting the tested matching engine's internals.
"""

from __future__ import annotations


def jaccard(a: set[str], b: set[str]) -> float:
    """Intersection-over-union of two skill-key sets."""
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union else 0.0


def overlap(candidate_skills: set[str], target_skills: set[str]) -> tuple[float, list[str], list[str]]:
    """Jaccard score plus matched/missing skills (from target_skills' own set)."""
    matched = sorted(candidate_skills & target_skills)
    missing = sorted(target_skills - candidate_skills)
    score = jaccard(candidate_skills, target_skills)
    return score, matched, missing
