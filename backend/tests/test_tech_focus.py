"""Unit tests for IT-sector job classification (no network)."""

from scraper.models import JobPosting
from scraper.tech_focus import filter_it_jobs, is_it_sector_job


def _job(title: str, skills: list[str] | None = None) -> JobPosting:
    return JobPosting(
        id="t-1",
        source="merojob",
        title=title,
        company="Acme",
        location="Kathmandu",
        required_skills=skills or [],
        salary_range="Not disclosed",
        source_url="https://example.com/j",
    )


def test_is_it_sector_keeps_developers():
    assert is_it_sector_job(_job("Backend Developer", ["Python", "Django"]))
    assert is_it_sector_job(_job("React Frontend Engineer"))
    assert is_it_sector_job(_job("QA Automation Engineer"))
    assert is_it_sector_job(_job("Data Analyst", ["SQL", "Python"]))


def test_is_it_sector_drops_non_tech():
    assert not is_it_sector_job(_job("Sales Executive", ["Communication"]))
    assert not is_it_sector_job(_job("Staff Nurse"))
    assert not is_it_sector_job(_job("Civil Engineer", ["AutoCAD"]))
    assert not is_it_sector_job(_job("Marketing Manager", ["SEO"]))


def test_filter_it_jobs_preserves_order():
    jobs = [
        _job("Sales Officer"),
        _job("Python Developer"),
        _job("Receptionist"),
        _job("DevOps Engineer"),
    ]
    kept = filter_it_jobs(jobs)
    assert [j.title for j in kept] == ["Python Developer", "DevOps Engineer"]
