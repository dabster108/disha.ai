"""Unit tests for CV contact regex extraction (no LLM calls)."""

from app.services.cv_parser import (
    _dedupe_skills,
    _guess_name_from_text,
    _merge_hints,
    extract_contact_hints,
    ParsedCV,
    ContactHints,
)


SAMPLE_CV = """
SITA GURUNG
sita.gurung@email.com | +977 9841112233 | Kathmandu

PROFESSIONAL SUMMARY
Computer Science graduate seeking a frontend developer role.

EDUCATION
BSc CSIT — Tribhuvan University — 2023

SKILLS
Python, React, SQL, Git
"""


def test_extract_email():
    hints = extract_contact_hints(SAMPLE_CV)
    assert hints.email == "sita.gurung@email.com"


def test_extract_phone():
    hints = extract_contact_hints(SAMPLE_CV)
    assert hints.phone is not None
    assert "9841112233" in hints.phone.replace(" ", "")


def test_guess_name():
    hints = extract_contact_hints(SAMPLE_CV)
    assert hints.full_name == "Sita Gurung"


def test_merge_hints_fills_empty_llm_fields():
    parsed = ParsedCV(skills=["Python"])
    merged = _merge_hints(parsed, ContactHints(full_name="Sita Gurung", email="a@b.com", phone="+977 98"))
    assert merged.full_name == "Sita Gurung"
    assert merged.email == "a@b.com"
    assert merged.phone == "+977 98"
    assert merged.skills == ["Python"]


def test_merge_hints_does_not_overwrite_llm():
    parsed = ParsedCV(full_name="Already Set", email="x@y.com")
    merged = _merge_hints(parsed, ContactHints(full_name="Other Name", email="other@z.com"))
    assert merged.full_name == "Already Set"
    assert merged.email == "x@y.com"


def test_dedupe_skills():
    assert _dedupe_skills(["Python", "python", " React ", "React"]) == ["Python", "React"]
