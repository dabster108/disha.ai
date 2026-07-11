"""Offline tests for the Nepal job-signal cleanup that feeds Skill Gap.

Two layers:
  1. Pure classifier/demand unit tests (no I/O).
  2. compute_market_gap with search_jobs monkeypatched to a small Nepal
     fixture — so the market-signal quality is asserted without depending on
     live Chroma contents (which are noisy and change with every scrape).

The corpus problem these guard against: Nepal sales/marketing postings whose
scraped skill lists carry stray tech tokens (php/html) used to be classified as
"backend" and pollute an IT student's market demand with SEO/Negotiation/
AutoCAD/Photoshop instead of Python/FastAPI/Docker.
"""

from types import SimpleNamespace

from app.rag import documents as doc
from app.services import skill_gap as sg


# --------------------------------------------------------------------------
# 1. Classifier: title is authoritative for the tech-vs-non-tech decision
# --------------------------------------------------------------------------

def test_sales_title_with_tech_skill_noise_stays_non_tech():
    # The exact live failure: a sales job listing php/html was tagged "backend".
    assert doc.infer_role_category("Corporate Sales Executive", ["Php", "Html", "Seo"]) == "sales"
    assert doc.infer_role_category("Direct Sales Representative (DSR)", ["Php", "Html"]) == "sales"


def test_non_software_engineer_titles_are_not_tech():
    assert doc.infer_role_category("Senior Structural Engineer", ["AutoCAD"]) == "general"
    assert doc.infer_role_category("Biomedical Engineer", []) == "general"
    assert doc.infer_role_category("Field Service Engineer", ["Communication"]) == "general"


def test_genuine_tech_titles_stay_tech():
    assert doc.infer_role_category("Full Stack Developer", ["Python", "AWS"]) == "fullstack"
    assert doc.infer_role_category("Backend Developer", ["Python", "FastAPI"]) == "backend"
    assert doc.infer_role_category("AI-Ready PHP Developer", ["Html", "Css"]) == "backend"
    assert doc.infer_role_category("Software Engineer", ["Java"]) == "software"


def test_title_is_non_technical():
    assert doc.title_is_non_technical("Corporate Sales Executive") is True
    assert doc.title_is_non_technical("Staff Nurse") is True
    assert doc.title_is_non_technical("Senior Structural Engineer") is True
    assert doc.title_is_non_technical("Backend Developer") is False
    assert doc.title_is_non_technical("Full Stack Developer") is False


def test_is_technical_role():
    assert doc.is_technical_role("Backend Developer") is True
    assert doc.is_technical_role("Data Scientist") is True
    assert doc.is_technical_role("Staff Nurse") is False
    assert doc.is_technical_role("Sales Executive") is False
    assert doc.is_technical_role(None) is False


# --------------------------------------------------------------------------
# 2. Demand aggregation cleaning
# --------------------------------------------------------------------------

def _job(title, category, skills):
    return {
        "title": title,
        "role_category": category,
        "required_skills": skills,
        "company": "Acme Pvt Ltd",
        "location": "Kathmandu",
        "source_url": "https://example.com/job",
        "similarity": 0.7,
    }


def test_demand_tech_only_skips_non_tech_category_jobs():
    jobs = [
        _job("Backend Developer", "backend", ["Python", "FastAPI"]),
        _job("Corporate Sales Executive", "sales", ["Php", "Seo", "Negotiation"]),
        _job("Graphic Designer", "design", ["Adobe Photoshop", "Adobe Illustrator"]),
    ]
    demand = sg._demand_from_jobs(jobs, tech_only=True)
    keys = set(demand)
    assert "python" in keys and "fastapi" in keys
    # sales + design skills excluded (design is not in the demand tech set)
    assert "seo" not in keys and "negotiation" not in keys
    assert sg.normalize_skill_name("Adobe Photoshop") not in keys


def test_demand_drop_soft_skills_removes_noise_but_keeps_tech():
    jobs = [_job("Backend Developer", "backend", ["Python", "Communication", "SEO", "Docker", "Teamwork"])]
    demand = sg._demand_from_jobs(jobs, tech_only=True, drop_soft_skills=True)
    keys = set(demand)
    assert "python" in keys and "docker" in keys
    assert "communication" not in keys and "seo" not in keys and "teamwork" not in keys


def test_demand_without_flags_is_unchanged_for_non_tech_targets():
    # Default behaviour (both flags False) keeps everything — nurses/sales
    # students still get their real market skills.
    jobs = [_job("Staff Nurse", "nursing", ["Patient Care", "Teamwork"])]
    demand = sg._demand_from_jobs(jobs)
    assert set(demand) == {sg.normalize_skill_name("Patient Care"), sg.normalize_skill_name("Teamwork")}


# --------------------------------------------------------------------------
# 3. compute_market_gap with a mocked Nepal fixture
# --------------------------------------------------------------------------

_NEPAL_TECH_FIXTURE = [
    _job("Backend Developer (Python/FastAPI)", "backend", ["Python", "FastAPI", "PostgreSQL", "Docker", "Communication"]),
    _job("Full Stack Developer – Django", "fullstack", ["Python", "Django Framework", "React", "AWS"]),
    _job("Software Engineer", "software", ["Java", "SQL", "Git", "REST API"]),
    # noise postings that leaked into retrieval — must NOT shape a dev's demand
    _job("Corporate Sales Executive", "sales", ["Php", "Html", "Seo", "Negotiation"]),
    _job("Graphic Designer", "design", ["Adobe Photoshop", "Branding"]),
]


def test_market_gap_for_backend_dev_surfaces_it_skills_not_noise(monkeypatch):
    monkeypatch.setattr(sg, "search_jobs", lambda role, n=15: list(_NEPAL_TECH_FIXTURE))
    monkeypatch.setattr(
        sg, "get_settings",
        lambda: SimpleNamespace(gap_tech_demand_tech_jobs_only=True, gap_tech_demand_drop_soft_skills=True),
    )

    gap = sg.compute_market_gap(["Python"], "Backend Developer", n_jobs=15)
    missing = {e["skill"].casefold() for e in gap["missing_skills"]}
    matched = {e["skill"].casefold() for e in gap["matched_skills"]}

    # real IT skills surface
    assert "fastapi" in missing
    assert "postgresql" in missing
    assert "docker" in missing
    assert "python" in matched
    # sales/design/soft noise is gone
    assert "seo" not in missing
    assert "negotiation" not in missing
    assert "php" not in missing
    assert "adobe photoshop" not in missing
    assert "communication" not in missing


def test_market_gap_for_non_tech_target_keeps_all_skills(monkeypatch):
    nurse_jobs = [
        _job("Staff Nurse", "nursing", ["Patient Care", "Teamwork", "Communication"]),
        _job("Health Assistant", "nursing", ["First Aid", "Communication"]),
    ]
    monkeypatch.setattr(sg, "search_jobs", lambda role, n=15: list(nurse_jobs))
    monkeypatch.setattr(
        sg, "get_settings",
        lambda: SimpleNamespace(gap_tech_demand_tech_jobs_only=True, gap_tech_demand_drop_soft_skills=True),
    )

    gap = sg.compute_market_gap([], "Staff Nurse", n_jobs=15)
    missing = {e["skill"].casefold() for e in gap["missing_skills"]}
    # non-tech target → no filtering, communication/teamwork are legitimate demand
    assert "communication" in missing
    assert "teamwork" in missing
    assert "patient care" in missing
