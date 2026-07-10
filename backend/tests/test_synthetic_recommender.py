"""Unit tests for the Synthetic Recommendation Lab's scoring logic.

Uses hand-built SyntheticJob objects rather than the real 100k-row CSV, so
these stay fast and don't depend on the dataset file being present.
"""

from app.services.skill_overlap import jaccard as _jaccard
from app.services.synthetic_recommender import (
    SyntheticJob,
    _score,
    _skills_from_text,
    recommend,
)


def _job(job_id: str, requirements: str) -> SyntheticJob:
    return SyntheticJob(
        job_id=job_id,
        requirements_text=requirements,
        requirements_skills=_skills_from_text(requirements),
    )


def test_skills_from_text_normalizes_and_splits():
    skills = _skills_from_text("Python, AI, Machine Learning")
    assert "python" in skills
    # The skills catalog aliases "AI" to "Machine Learning", so both collapse
    # onto the same normalized key rather than staying as two separate skills.
    assert "machine learning" in skills
    assert len(skills) == 2


def test_jaccard_full_overlap_scores_higher_than_partial():
    a = {"python", "sql"}
    b_full = {"python", "sql"}
    b_partial = {"python", "java"}
    b_none = {"css", "html"}

    assert _jaccard(a, b_full) == 1.0
    assert _jaccard(a, b_partial) > _jaccard(a, b_none)
    assert _jaccard(a, b_none) == 0.0


def test_score_reports_matched_and_missing_skills():
    user_skills = {"python", "sql"}
    job = _job("1", "Python, SQL, CSS")

    score, matched, missing = _score(user_skills, job)

    assert matched == ["python", "sql"]
    assert missing == ["css"]
    assert 0 < score < 1


def test_recommend_orders_jobs_by_skill_overlap(monkeypatch):
    from app.services import synthetic_recommender as mod

    strong = _job("1", "Python, SQL")
    weak = _job("2", "Java, HTML")
    no_overlap = _job("3", "CSS, HTML")

    dataset = mod._Dataset(
        jobs={j.job_id: j for j in (strong, weak, no_overlap)},
        rows=[],
    )
    monkeypatch.setattr(mod, "_load_dataset", lambda: dataset)

    result = recommend(["Python", "SQL"], top_k=3)

    assert result["reason"] is None
    ordered_ids = [m["job_id"] for m in result["matches"]]
    assert ordered_ids[0] == "1"
    assert ordered_ids[-1] == "3"


def test_recommend_cold_start_on_empty_skills():
    assert recommend([]) == {"matches": [], "reason": "no_skills"}
    assert recommend(None) == {"matches": [], "reason": "no_skills"}
    assert recommend(["   ", ""]) == {"matches": [], "reason": "no_skills"}
