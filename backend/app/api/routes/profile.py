from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models import StudentProfile
from app.services.cv_parser import EducationEntry, ExperienceEntry, extract_text, parse_cv

router = APIRouter(prefix="/api/profile", tags=["profile"])

MAX_RESUME_BYTES = 5 * 1024 * 1024


class ProfileCreate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None
    years_of_experience: float | None = Field(None, ge=0, le=50)
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    skills: list[str] = Field(min_length=1, description="Skill names, e.g. ['Python', 'SQL']")
    skills_source: Literal["manual", "cv"] = "manual"
    target_role: str = Field(min_length=2, max_length=255)
    location: str | None = None
    time_per_week: int | None = Field(None, ge=1, le=100, description="Hours available per week")
    budget: str | None = Field(None, description="e.g. 'free', 'NPR 5000/month'")


class ProfileOut(ProfileCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class ResumeParseResult(BaseModel):
    filename: str
    full_name: str | None
    email: str | None
    phone: str | None
    summary: str | None
    years_of_experience: float | None
    education: list[EducationEntry]
    experience: list[ExperienceEntry]
    skills: list[str]
    skills_source: Literal["cv"] = "cv"
    suggested_target_role: str | None
    extraction: str  # 'mistral-ocr' | 'pypdf' | 'docx' | combined
    parse_warnings: list[str] = Field(default_factory=list)
    note: str = "Review these fields, then save them via POST /api/profile."


@router.post("", response_model=ProfileOut, status_code=201)
async def create_profile(payload: ProfileCreate, db: AsyncSession = Depends(get_db)) -> StudentProfile:
    data = payload.model_dump()
    data["education"] = [entry.model_dump() for entry in payload.education]
    data["experience"] = [entry.model_dump() for entry in payload.experience]
    profile = StudentProfile(**data)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/{student_id}", response_model=ProfileOut)
async def get_profile(student_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> StudentProfile:
    profile = await db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/upload-resume", response_model=ResumeParseResult)
async def upload_resume(file: UploadFile = File(...)) -> ResumeParseResult:
    """Extract profile fields from a PDF/DOCX resume.

    Parsed data is returned for the student to review — nothing is saved until
    they confirm via POST /api/profile with skills_source='cv'.
    """
    content = await file.read()
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail="Resume larger than 5 MB")

    try:
        text, extraction = await extract_text(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read that file — is it a valid PDF/DOCX?")

    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text from the resume.",
        )

    parsed, warnings = await parse_cv(text)
    return ResumeParseResult(
        filename=file.filename or "resume",
        full_name=parsed.full_name,
        email=parsed.email,
        phone=parsed.phone,
        summary=parsed.summary,
        years_of_experience=parsed.years_of_experience,
        education=parsed.education,
        experience=parsed.experience,
        skills=parsed.skills,
        suggested_target_role=parsed.suggested_target_role,
        extraction=extraction,
        parse_warnings=warnings,
    )
