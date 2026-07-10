"""Resume text extraction + Groq-powered CV parsing.

Extraction path:
- PDF  -> Mistral OCR 3 (handles scanned/image resumes) -> pypdf fallback
- DOCX -> python-docx (already structured text; OCR takes only PDF/images)

Groq structures the full CV (name, experience, education, skills). The result
is returned to the student for confirmation — never auto-saved.
"""

from __future__ import annotations

import base64
import io
from functools import lru_cache

import httpx
from docx import Document
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from pypdf import PdfReader

from app.config import get_settings

MAX_CV_CHARS = 12000
MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"


class ExperienceEntry(BaseModel):
    title: str = Field(description="Job title or role held.")
    company: str | None = Field(None, description="Employer or organization name.")
    start_date: str | None = Field(None, description="Start date as written on CV, e.g. 'Jan 2023'.")
    end_date: str | None = Field(
        None,
        description="End date as written on CV, or 'Present' if current role.",
    )
    description: str | None = Field(None, description="Brief summary of responsibilities and achievements.")


class EducationEntry(BaseModel):
    degree: str = Field(description="Degree or qualification, e.g. 'BCA', 'BSc Computer Science'.")
    institution: str | None = Field(None, description="School, college, or university name.")
    year: str | None = Field(None, description="Graduation year or date range as written on CV.")


class ParsedCV(BaseModel):
    full_name: str | None = Field(None, description="Candidate's full name from the CV header.")
    email: str | None = Field(None, description="Email address if present.")
    phone: str | None = Field(None, description="Phone number if present.")
    summary: str | None = Field(None, description="Professional summary or objective, if present.")
    years_of_experience: float | None = Field(
        None,
        description="Total years of professional experience inferred from work history.",
    )
    education: list[EducationEntry] = Field(
        default_factory=list,
        description="Education entries, most recent first.",
    )
    experience: list[ExperienceEntry] = Field(
        default_factory=list,
        description="Work experience entries, most recent first.",
    )
    skills: list[str] = Field(
        default_factory=list,
        description="Concrete skills the candidate demonstrably has. No duplicates, no invented skills.",
    )
    suggested_target_role: str | None = Field(
        None,
        description="The job role this CV is most obviously aimed at, if clear.",
    )


async def extract_text(filename: str, content: bytes) -> tuple[str, str]:
    """Return (text, extraction_method). Never hard-fails on OCR problems."""
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        settings = get_settings()
        if settings.mistral_api_key:
            try:
                text = await _ocr_pdf_with_mistral(content)
                if text.strip():
                    return text, "mistral-ocr"
            except Exception as exc:
                print(f"Mistral OCR failed ({type(exc).__name__}: {exc}); falling back to pypdf")
        return _extract_pdf_text(content), "pypdf"
    if lowered.endswith(".docx"):
        return _extract_docx_text(content), "docx"
    raise ValueError("Unsupported file type — upload a .pdf or .docx resume.")


async def _ocr_pdf_with_mistral(content: bytes) -> str:
    settings = get_settings()
    encoded = base64.standard_b64encode(content).decode("ascii")
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            MISTRAL_OCR_URL,
            headers={"Authorization": f"Bearer {settings.mistral_api_key}"},
            json={
                "model": settings.mistral_ocr_model,
                "document": {
                    "type": "document_url",
                    "document_url": f"data:application/pdf;base64,{encoded}",
                },
            },
        )
        response.raise_for_status()
        pages = response.json().get("pages") or []
    return "\n\n".join(page.get("markdown") or "" for page in pages)


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx_text(content: bytes) -> str:
    document = Document(io.BytesIO(content))
    parts = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    for table in document.tables:
        for row in table.rows:
            parts.extend(cell.text for cell in row.cells if cell.text.strip())
    return "\n".join(parts)


@lru_cache
def _llm() -> ChatGroq:
    settings = get_settings()
    return ChatGroq(
        model=settings.groq_model,
        temperature=0.0,
        api_key=settings.groq_api_key,
    )


async def parse_cv(cv_text: str) -> ParsedCV:
    structured_llm = _llm().with_structured_output(ParsedCV)
    prompt = (
        "You are a careful CV parser for a Nepali career platform. "
        "Extract structured profile data from the resume text below. "
        "Only include information actually present in the text — do not invent. "
        "Normalize skill names (e.g. 'ReactJS' -> 'React'). "
        "List experience and education most recent first.\n\n"
        f"Resume text:\n{cv_text[:MAX_CV_CHARS]}"
    )
    return await structured_llm.ainvoke(prompt)


# Backward-compatible alias used by older imports.
parse_cv_skills = parse_cv
