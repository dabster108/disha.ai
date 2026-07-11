from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.models import LearningCurriculum, Roadmap, StudentProfile, User
from app.services.cv_parser import EducationEntry, ExperienceEntry, extract_text, parse_cv

router = APIRouter(prefix="/api/profile", tags=["profile"])

MAX_RESUME_BYTES = 5 * 1024 * 1024


class ProfileCreate(BaseModel):
    clerk_user_id: str | None = Field(None, min_length=1, max_length=255)
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
    profile_meta: dict = Field(default_factory=dict)
    settings_meta: dict = Field(default_factory=dict)
    created_at: datetime


class ProfilePatch(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None
    years_of_experience: float | None = Field(None, ge=0, le=50)
    education: list[EducationEntry] | None = None
    experience: list[ExperienceEntry] | None = None
    skills: list[str] | None = Field(None, min_length=1)
    skills_source: Literal["manual", "cv"] | None = None
    target_role: str | None = Field(None, min_length=2, max_length=255)
    location: str | None = None
    time_per_week: int | None = Field(None, ge=1, le=100)
    budget: str | None = None
    profile_meta: dict | None = None
    settings_meta: dict | None = None


def _deep_merge(base: dict, patch: dict) -> dict:
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


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


async def _get_or_create_user(
    db: AsyncSession,
    *,
    clerk_user_id: str,
    email: str | None,
    full_name: str | None,
) -> User:
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is not None:
        if full_name and not user.full_name:
            user.full_name = full_name
        if email and user.email.endswith("@users.clerk.invalid"):
            user.email = email
        return user

    if email:
        result = await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
        user = result.scalar_one_or_none()
        if user is not None:
            if user.clerk_user_id and user.clerk_user_id != clerk_user_id:
                raise HTTPException(
                    status_code=409,
                    detail="This email is already linked to a different account.",
                )
            user.clerk_user_id = clerk_user_id
            if full_name and not user.full_name:
                user.full_name = full_name
            return user

    resolved_email = email or f"{clerk_user_id}@users.clerk.invalid"
    user = User(clerk_user_id=clerk_user_id, email=resolved_email, full_name=full_name)
    db.add(user)
    await db.flush()
    return user


async def _latest_profile_for_user(db: AsyncSession, user_id: uuid.UUID) -> StudentProfile | None:
    result = await db.execute(
        select(StudentProfile)
        .where(StudentProfile.user_id == user_id)
        .order_by(StudentProfile.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _profile_for_clerk_user(
    db: AsyncSession,
    clerk_user_id: str,
    *,
    email: str | None = None,
) -> StudentProfile | None:
    """Resolve the student's profile for a Clerk account, linking legacy rows by email when needed."""
    email_norm = email.strip().lower() if email and email.strip() else None

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is not None:
        profile = await _latest_profile_for_user(db, user.id)
        if profile is not None:
            return profile

    # Profile exists for this email but Clerk/user link was never saved (common after first onboarding).
    if email_norm:
        result = await db.execute(
            select(StudentProfile)
            .where(func.lower(StudentProfile.email) == email_norm)
            .order_by(StudentProfile.created_at.desc())
            .limit(1)
        )
        profile = result.scalar_one_or_none()
        if profile is not None:
            try:
                linked_user = await _get_or_create_user(
                    db,
                    clerk_user_id=clerk_user_id,
                    email=email,
                    full_name=profile.full_name,
                )
            except HTTPException:
                return None
            if profile.user_id != linked_user.id:
                profile.user_id = linked_user.id
            await db.commit()
            await db.refresh(profile)
            return profile

        # User row exists for email (no profile on that user yet) — attach Clerk id.
        result = await db.execute(select(User).where(func.lower(User.email) == email_norm))
        user_by_email = result.scalar_one_or_none()
        if user_by_email is not None:
            if user_by_email.clerk_user_id and user_by_email.clerk_user_id != clerk_user_id:
                return None
            user_by_email.clerk_user_id = clerk_user_id
            await db.flush()
            profile = await _latest_profile_for_user(db, user_by_email.id)
            if profile is not None:
                await db.commit()
                await db.refresh(profile)
                return profile

    # Legacy orphan profile (no user_id) matched by exact email from query param.
    if email and email.strip():
        result = await db.execute(
            select(StudentProfile)
            .where(
                func.lower(StudentProfile.email) == email.strip().lower(),
                StudentProfile.user_id.is_(None),
            )
            .order_by(StudentProfile.created_at.desc())
            .limit(1)
        )
        orphan = result.scalar_one_or_none()
        if orphan is not None:
            try:
                linked_user = await _get_or_create_user(
                    db,
                    clerk_user_id=clerk_user_id,
                    email=email,
                    full_name=orphan.full_name,
                )
            except HTTPException:
                return None
            orphan.user_id = linked_user.id
            await db.commit()
            await db.refresh(orphan)
            return orphan

    return None


@router.post("", response_model=ProfileOut, status_code=201)
async def create_profile(payload: ProfileCreate, db: AsyncSession = Depends(get_db)) -> StudentProfile:
    data = payload.model_dump(exclude={"clerk_user_id"})
    data["education"] = [entry.model_dump() for entry in payload.education]
    data["experience"] = [entry.model_dump() for entry in payload.experience]

    if payload.clerk_user_id:
        existing = await _profile_for_clerk_user(
            db, payload.clerk_user_id, email=payload.email
        )
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail="A profile already exists for this account. Use GET /api/profile/by-clerk/{clerk_user_id}.",
            )
        user = await _get_or_create_user(
            db,
            clerk_user_id=payload.clerk_user_id,
            email=payload.email,
            full_name=payload.full_name,
        )
        data["user_id"] = user.id

    profile = StudentProfile(**data)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/by-clerk/{clerk_user_id}", response_model=ProfileOut)
async def get_profile_by_clerk(
    clerk_user_id: str,
    email: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> StudentProfile:
    profile = await _profile_for_clerk_user(db, clerk_user_id, email=email)
    if profile is None:
        raise HTTPException(status_code=404, detail="No profile linked to this account yet")
    return profile


@router.get("/{student_id}", response_model=ProfileOut)
async def get_profile(student_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> StudentProfile:
    profile = await db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


async def _invalidate_plans_for_new_goal(db: AsyncSession, profile_id: uuid.UUID) -> None:
    """Mark the profile's active roadmap/curriculum as superseded when its
    target_role changes, so old-goal content stops being served.

    Both GET endpoints already filter to status == "active" (roadmap.py's
    latest_roadmap, learning.py's latest), so this alone hides the stale
    plan immediately: the roadmap page 404s and auto-regenerates for the new
    goal, and the learning page falls back to its normal "no curriculum yet"
    prompt. The underlying skill-gap snapshot isn't touched here — it's
    recomputed lazily, on demand, by get_or_create_current_snapshot() the
    next time a roadmap/curriculum is actually generated.
    """
    await db.execute(
        update(Roadmap)
        .where(Roadmap.profile_id == profile_id, Roadmap.status == "active")
        .values(status="replanned")
    )
    await db.execute(
        update(LearningCurriculum)
        .where(LearningCurriculum.profile_id == profile_id, LearningCurriculum.status == "active")
        .values(status="replanned")
    )


@router.patch("/{student_id}", response_model=ProfileOut)
async def update_profile(
    student_id: uuid.UUID,
    payload: ProfilePatch,
    db: AsyncSession = Depends(get_db),
) -> StudentProfile:
    profile = await db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    data = payload.model_dump(exclude_unset=True)

    if "education" in data and data["education"] is not None:
        data["education"] = [entry.model_dump() for entry in payload.education or []]
    if "experience" in data and data["experience"] is not None:
        data["experience"] = [entry.model_dump() for entry in payload.experience or []]

    profile_meta = data.pop("profile_meta", None)
    settings_meta = data.pop("settings_meta", None)

    goal_changed = "target_role" in data and data["target_role"] and data["target_role"] != profile.target_role

    for field, value in data.items():
        setattr(profile, field, value)

    if profile_meta is not None:
        profile.profile_meta = _deep_merge(profile.profile_meta or {}, profile_meta)
    if settings_meta is not None:
        profile.settings_meta = _deep_merge(profile.settings_meta or {}, settings_meta)

    if goal_changed:
        await _invalidate_plans_for_new_goal(db, profile.id)

    await db.commit()
    await db.refresh(profile)
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
