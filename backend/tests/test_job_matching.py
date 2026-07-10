"""Unit tests for multi-factor job matching."""

from types import SimpleNamespace

from app.services.job_matching import (
    _adjusted_role_similarity,
    _role_conflict_penalty,
    _seniority_match,
    match_label,
    score_job,
)


def _profile(**kwargs):
    defaults = {
        "target_role": "Backend Developer Python FastAPI",
        "skills": ["Python", "FastAPI", "PostgreSQL", "REST API"],
        "years_of_experience": 2.0,
        "location": "Kathmandu",
        "education": [{"degree": "BSc CSIT"}],
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _ctx(profile=None, interview=None, practice=None):
    return SimpleNamespace(
        profile=profile or _profile(),
        interview=interview,
        practice=practice,
        n_jobs=20,
    )


def test_backend_vs_frontend_conflict_penalty():
    penalty = _role_conflict_penalty("Backend Developer", "Frontend React Developer")
    assert penalty >= 0.35


def test_ai_engineer_vs_instructor_conflict():
    penalty = _role_conflict_penalty("AI Engineer", "AI Instructor")
    assert penalty >= 0.35


def test_product_manager_vs_project_manager_conflict():
    penalty = _role_conflict_penalty("Product Manager", "Project Manager")
    assert penalty >= 0.35


def test_adjusted_role_similarity_penalizes_adjacent_roles():
    base = 0.80
    adjusted = _adjusted_role_similarity(base, "Backend Developer", "Frontend Developer", ["React"])
    assert adjusted < base * 0.7


def test_seniority_mismatch_for_entry_candidate():
    assert _seniority_match(1.0, 5) < 0.25


def test_seniority_match_for_aligned_candidate():
    assert _seniority_match(2.0, 1) >= 0.75


def test_match_labels():
    assert match_label(92) == "Exceptional Match"
    assert match_label(80) == "Strong Match"
    assert match_label(65) == "Moderate Match"
    assert match_label(45) == "Weak Match"


def test_score_job_backend_match():
    job = {
        "id": "1",
        "title": "Backend Developer Python",
        "company": "Tech Co",
        "location": "Kathmandu",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "source_url": "https://example.com",
        "role_category": "backend",
        "similarity": 0.78,
        "semantic_similarity": 0.72,
    }
    result = score_job(job, _ctx())
    assert result["match_score"] <= 99
    assert result["match_score"] >= 55
    assert "Python" in " ".join(result["matched_skills"])
    assert any("Docker" in n for n in result["missing_skills"] + result["explanation"]["negatives"])


def test_score_job_rejects_marketing_for_backend_target():
    job = {
        "id": "2",
        "title": "Marketing Executive",
        "company": "Brand Co",
        "location": "Kathmandu",
        "required_skills": ["Digital Marketing", "SEO"],
        "source_url": "https://example.com",
        "role_category": "marketing",
        "similarity": 0.55,
        "semantic_similarity": 0.50,
    }
    result = score_job(job, _ctx())
    assert result["passes_thresholds"] is False


def test_generic_keyword_overlap_does_not_score_high():
    job = {
        "id": "3",
        "title": "AI Manager",
        "company": "Generic Co",
        "location": "Nepal",
        "required_skills": ["Communication"],
        "source_url": "https://example.com",
        "role_category": "general",
        "similarity": 0.60,
        "semantic_similarity": 0.58,
    }
    result = score_job(job, _ctx())
    assert result["match_score"] < 75
