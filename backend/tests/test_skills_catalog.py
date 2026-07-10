"""Unit tests for the canonical skills catalog."""

from app.services.skills_catalog import (
    all_skills,
    filter_to_catalog,
    load_catalog,
    normalize_skill,
    skills_for_role,
)


def test_catalog_loads_and_has_roles():
    catalog = load_catalog()
    assert catalog.version >= 1
    assert "Backend Developer" in catalog.roles
    assert len(catalog.roles) > 30


def test_all_skills_is_deduped_and_sorted():
    skills = all_skills()
    assert skills == sorted(set(skills))
    assert "Python" in skills


def test_skills_for_role_known_role():
    skills = skills_for_role("Backend Developer")
    assert "Python" in skills
    assert "FastAPI" in skills
    # global skills are appended too
    assert "Communication" in skills


def test_skills_for_role_loose_match():
    skills = skills_for_role("Senior Backend Developer")
    assert "Python" in skills


def test_skills_for_role_unknown_role_falls_back_to_global():
    skills = skills_for_role("Underwater Basket Weaver")
    assert skills  # global skills, non-empty
    assert "Python" not in skills


def test_skills_for_role_none_returns_global():
    assert skills_for_role(None) == skills_for_role("")


def test_normalize_skill_resolves_aliases_and_case():
    assert normalize_skill("reactjs") == "React"
    assert normalize_skill("REACT") == "React"
    assert normalize_skill("nodejs") == "Node.js"


def test_normalize_skill_unknown_returns_none():
    assert normalize_skill("Underwater Basket Weaving") is None
    assert normalize_skill("") is None
    assert normalize_skill(None) is None


def test_filter_to_catalog_drops_unknown_and_dedupes():
    result = filter_to_catalog(["ReactJS", "React", "Python", "Underwater Basket Weaving", ""])
    assert result == ["React", "Python"]


def test_filter_to_catalog_empty_input():
    assert filter_to_catalog([]) == []
    assert filter_to_catalog(None) == []
