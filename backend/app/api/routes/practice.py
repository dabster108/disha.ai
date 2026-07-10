"""Skill-practice / game endpoints.

Separate from /api/interview — its own tables and flow. Student picks 1-3 skills,
gets one challenge per skill (coding for tech, scenario for non-tech), submits,
and gets an AI score vs a pass threshold. Session end returns verified strong/weak
skills in a shape ready for a later combined skill-gap.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.config import get_settings
from app.db.models import PracticeChallenge, PracticeSession, StudentProfile
from app.services.practice import (
    adapt_difficulty,
    choose_difficulty,
    detect_track,
    evaluate_submission,
    generate_coding_challenge,
    generate_scenario_challenge,
    skill_level_for_score,
    suggest_skills,
    summarize_session,
)

router = APIRouter(prefix="/api/practice", tags=["practice"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------


class SuggestRequest(BaseModel):
    profile_id: uuid.UUID


class SuggestResponse(BaseModel):
    suggested_skills: list[str]
    track: Literal["tech", "nontech"]


class StartRequest(BaseModel):
    profile_id: uuid.UUID
    skills: list[str] = Field(min_length=1)
    difficulty: Literal["easy", "medium", "hard", "auto"] = "auto"


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    challenge_index: int
    skill: str
    challenge_type: Literal["coding", "scenario"]
    difficulty: Literal["easy", "medium", "hard"]
    prompt: str
    starter_code: str | None
    expected_language: str | None
    score: float | None
    passed: bool | None
    verified_skill_level: str | None
    feedback: str | None
    dimensions: dict | None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    target_role: str
    track: Literal["tech", "nontech"]
    difficulty: Literal["easy", "medium", "hard"]
    skills_selected: list
    status: Literal["started", "completed"]
    overall_score: float | None
    pass_threshold: float
    verified_strong_skills: list | None
    verified_weak_skills: list | None
    skill_scores: dict | None
    summary: str | None
    started_at: datetime
    finished_at: datetime | None
    challenges: list[ChallengeOut]


class StartResponse(BaseModel):
    session_id: uuid.UUID
    track: Literal["tech", "nontech"]
    difficulty: Literal["easy", "medium", "hard"]
    pass_threshold: float
    total_challenges: int
    current_challenge: ChallengeOut


class SubmitRequest(BaseModel):
    challenge_id: uuid.UUID
    code: str | None = None
    explanation: str | None = None
    answer: str | None = None


class SubmitResponse(BaseModel):
    score: float
    passed: bool
    verified_skill_level: str
    feedback: str
    dimensions: dict
    next_challenge: ChallengeOut | None
    session_completed: bool
    session: SessionOut | None = Field(None, description="Full session with summary when completed.")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


async def _get_profile_or_404(db: AsyncSession, profile_id: uuid.UUID) -> StudentProfile:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


async def _get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> PracticeSession:
    query: Select[tuple[PracticeSession]] = (
        select(PracticeSession)
        .options(selectinload(PracticeSession.challenges))
        .where(PracticeSession.id == session_id)
    )
    session = (await db.execute(query)).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Practice session not found")
    return session


async def _build_challenge(profile: StudentProfile, track: str, skill: str, difficulty: str, index: int) -> PracticeChallenge:
    if track == "tech":
        gen = await generate_coding_challenge(profile, skill, difficulty)
        return PracticeChallenge(
            challenge_index=index,
            skill=skill,
            challenge_type="coding",
            difficulty=difficulty,
            prompt=gen.prompt,
            starter_code=gen.starter_code,
            expected_language=gen.expected_language,
            evaluation_hints=gen.evaluation_hints,
        )
    gen = await generate_scenario_challenge(profile, skill, difficulty)
    return PracticeChallenge(
        challenge_index=index,
        skill=skill,
        challenge_type="scenario",
        difficulty=difficulty,
        prompt=gen.prompt,
        starter_code=None,
        expected_language=None,
        evaluation_hints=gen.what_good_answer_includes,
    )


def _sorted_challenges(session: PracticeSession) -> list[PracticeChallenge]:
    return sorted(session.challenges, key=lambda c: c.challenge_index)


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@router.post("/skills/suggest", response_model=SuggestResponse)
async def suggest(payload: SuggestRequest, db: AsyncSession = Depends(get_db)) -> SuggestResponse:
    profile = await _get_profile_or_404(db, payload.profile_id)
    skills, track = suggest_skills(profile)
    if not skills:
        raise HTTPException(status_code=422, detail="Profile has no skills to practise — add skills first.")
    return SuggestResponse(suggested_skills=skills, track=track)


@router.post("/start", response_model=StartResponse, status_code=201)
async def start(payload: StartRequest, db: AsyncSession = Depends(get_db)) -> StartResponse:
    settings = get_settings()
    profile = await _get_profile_or_404(db, payload.profile_id)

    skills = [s.strip() for s in payload.skills if s and s.strip()]
    if not skills:
        raise HTTPException(status_code=422, detail="At least one non-empty skill is required")
    max_skills = settings.practice_max_skills_per_session
    if len(skills) > max_skills:
        raise HTTPException(status_code=422, detail=f"At most {max_skills} skills per session")

    track = detect_track(profile.target_role, skills)
    difficulty = choose_difficulty(profile) if payload.difficulty == "auto" else payload.difficulty

    session = PracticeSession(
        profile_id=profile.id,
        target_role=profile.target_role,
        track=track,
        difficulty=difficulty,
        skills_selected=skills,
        status="started",
        pass_threshold=settings.practice_pass_threshold,
    )
    db.add(session)

    # Challenges are generated lazily (first now, each next on submit) so one
    # request never fires N Groq calls — faster start, no rate-limit pileup.
    first = await _build_challenge(profile, track, skills[0], difficulty, 0)
    first.session = session
    db.add(first)

    await db.commit()
    session = await _get_session_or_404(db, session.id)
    challenges = _sorted_challenges(session)
    return StartResponse(
        session_id=session.id,
        track=track,  # type: ignore[arg-type]
        difficulty=difficulty,  # type: ignore[arg-type]
        pass_threshold=session.pass_threshold,
        total_challenges=len(skills),
        current_challenge=ChallengeOut.model_validate(challenges[0]),
    )


@router.post("/{session_id}/submit", response_model=SubmitResponse)
async def submit(session_id: uuid.UUID, payload: SubmitRequest, db: AsyncSession = Depends(get_db)) -> SubmitResponse:
    session = await _get_session_or_404(db, session_id)
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Practice session already completed")

    challenges = _sorted_challenges(session)
    challenge = next((c for c in challenges if c.id == payload.challenge_id), None)
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found in this session")
    if challenge.answer_code is not None or challenge.answer_text is not None:
        raise HTTPException(status_code=409, detail="This challenge was already submitted")

    if challenge.challenge_type == "coding":
        if not (payload.code and payload.code.strip()):
            raise HTTPException(status_code=422, detail="`code` is required for coding challenges")
    else:
        if not (payload.answer and payload.answer.strip()):
            raise HTTPException(status_code=422, detail="`answer` is required for scenario challenges")

    evaluation = await evaluate_submission(
        skill=challenge.skill,
        difficulty=challenge.difficulty,
        challenge_type=challenge.challenge_type,
        prompt=challenge.prompt,
        evaluation_hints=challenge.evaluation_hints or [],
        code=payload.code,
        explanation=payload.explanation,
        answer=payload.answer,
    )

    score = round(evaluation.score, 2)
    passed = score >= session.pass_threshold
    # Derive level from score so it can't contradict the number (the 8b model
    # occasionally returns e.g. score 8 with level "weak").
    verified_level = skill_level_for_score(score)
    challenge.answer_code = payload.code.strip() if payload.code else None
    challenge.answer_text = payload.answer.strip() if payload.answer else None
    challenge.explanation = payload.explanation.strip() if payload.explanation else None
    challenge.score = score
    challenge.passed = passed
    challenge.verified_skill_level = verified_level
    challenge.feedback = evaluation.feedback
    challenge.dimensions = {
        "scores": evaluation.dimensions,
        "strengths": evaluation.strengths,
        "weaknesses": evaluation.weaknesses,
    }
    challenge.answered_at = datetime.now(timezone.utc)

    profile = await _get_profile_or_404(db, session.profile_id)
    skills = session.skills_selected or []
    next_index = challenge.challenge_index + 1
    next_challenge: PracticeChallenge | None = None

    if next_index < len(skills):
        # Adapt the next challenge's difficulty to how this one scored.
        next_difficulty = adapt_difficulty(score)
        next_challenge = await _build_challenge(
            profile, session.track, skills[next_index], next_difficulty, next_index
        )
        # Attach via relationship so session.challenges stays consistent after
        # commit (expire_on_commit=False keeps these objects usable, no re-fetch).
        next_challenge.session = session
        db.add(next_challenge)
    else:
        answered = _sorted_challenges(session)
        skill_scores = {c.skill: c.score for c in answered if c.score is not None}
        strong = sorted({c.skill for c in answered if c.passed})
        weak = sorted({c.skill for c in answered if c.passed is False})
        overall = round(sum(skill_scores.values()) / max(len(skill_scores), 1), 2)
        summary_text = await summarize_session(profile, skill_scores, strong, weak)
        session.status = "completed"
        session.overall_score = overall
        session.verified_strong_skills = strong
        session.verified_weak_skills = weak
        session.skill_scores = skill_scores
        session.summary = summary_text
        session.finished_at = datetime.now(timezone.utc)

    await db.commit()

    next_out = ChallengeOut.model_validate(next_challenge) if next_challenge is not None else None
    session_out = SessionOut.model_validate(session) if session.status == "completed" else None

    return SubmitResponse(
        score=score,
        passed=passed,
        verified_skill_level=verified_level,
        feedback=evaluation.feedback,
        dimensions=evaluation.dimensions,
        next_challenge=next_out,
        session_completed=session.status == "completed",
        session=session_out,
    )


@router.get("/history/{profile_id}", response_model=list[SessionOut])
async def history(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[SessionOut]:
    await _get_profile_or_404(db, profile_id)
    query: Select[tuple[PracticeSession]] = (
        select(PracticeSession)
        .options(selectinload(PracticeSession.challenges))
        .where(PracticeSession.profile_id == profile_id)
        .order_by(PracticeSession.started_at.desc())
    )
    sessions = (await db.execute(query)).scalars().all()
    return [SessionOut.model_validate(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> SessionOut:
    session = await _get_session_or_404(db, session_id)
    return SessionOut.model_validate(session)
