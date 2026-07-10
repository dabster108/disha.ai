from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.db.models import InterviewSession, InterviewTurn, StudentProfile
from app.services.interview import (
    MAX_QUESTION_TURNS,
    build_welcome_message,
    choose_initial_difficulty,
    detect_track,
    evaluate_answer,
    generate_next_question,
    generate_opening_question,
    summarize_session,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])


class InterviewStartRequest(BaseModel):
    profile_id: uuid.UUID


class InterviewAnswerRequest(BaseModel):
    session_id: uuid.UUID
    answer: str


class InterviewTurnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    turn_index: int
    question: str
    answer: str | None
    question_type: Literal["opening", "technical", "conceptual", "scenario", "behavioral"]
    skill_tag: str | None
    difficulty: Literal["easy", "medium", "hard"]
    score: float | None
    feedback: str | None
    dimensions: dict | None
    created_at: datetime


class InterviewSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    target_role: str
    track: Literal["tech", "nontech"]
    difficulty: Literal["easy", "medium", "hard"]
    status: Literal["started", "completed"]
    overall_score: float | None
    summary: str | None
    strengths: list | None
    weaknesses: list | None
    started_at: datetime
    finished_at: datetime | None
    turns: list[InterviewTurnOut]


class InterviewStartResponse(BaseModel):
    session: InterviewSessionOut
    welcome_message: str
    next_question: InterviewTurnOut


class InterviewAnswerResponse(BaseModel):
    session: InterviewSessionOut
    evaluated_turn: InterviewTurnOut
    next_question: InterviewTurnOut | None
    interview_completed: bool


async def _get_profile_or_404(db: AsyncSession, profile_id: uuid.UUID) -> StudentProfile:
    profile = await db.get(StudentProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


async def _get_session_with_turns_or_404(db: AsyncSession, session_id: uuid.UUID) -> InterviewSession:
    query: Select[tuple[InterviewSession]] = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .where(InterviewSession.id == session_id)
    )
    session = (await db.execute(query)).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session


def _sort_turns(session: InterviewSession) -> list[InterviewTurn]:
    return sorted(session.turns, key=lambda turn: turn.turn_index)


@router.post("/start", response_model=InterviewStartResponse, status_code=201)
async def start_interview(
    payload: InterviewStartRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewStartResponse:
    profile = await _get_profile_or_404(db, payload.profile_id)
    track = detect_track(profile)
    difficulty = choose_initial_difficulty(profile)
    welcome_message = build_welcome_message(profile, track, difficulty)
    opening_question = await generate_opening_question(profile, track, difficulty)

    session = InterviewSession(
        profile_id=profile.id,
        target_role=profile.target_role,
        track=track,
        difficulty=difficulty,
        status="started",
    )
    first_turn = InterviewTurn(
        session=session,
        turn_index=1,
        question=opening_question.question,
        question_type=opening_question.question_type,
        skill_tag=opening_question.skill_tag,
        difficulty=opening_question.difficulty,
    )
    db.add_all([session, first_turn])
    await db.commit()

    session = await _get_session_with_turns_or_404(db, session.id)
    turns = _sort_turns(session)
    return InterviewStartResponse(
        session=InterviewSessionOut.model_validate(session),
        welcome_message=welcome_message,
        next_question=InterviewTurnOut.model_validate(turns[0]),
    )


@router.post("/answer", response_model=InterviewAnswerResponse)
async def answer_interview(
    payload: InterviewAnswerRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewAnswerResponse:
    session = await _get_session_with_turns_or_404(db, payload.session_id)
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Interview session already completed")

    turns = _sort_turns(session)
    current_turn = next((turn for turn in turns if turn.answer is None), None)
    if current_turn is None:
        raise HTTPException(status_code=409, detail="No pending interview question found")

    if not payload.answer.strip():
        raise HTTPException(status_code=422, detail="Answer cannot be empty")

    profile = await _get_profile_or_404(db, session.profile_id)
    previous_turns = [turn for turn in turns if turn.turn_index < current_turn.turn_index]
    evaluation = await evaluate_answer(profile, session, current_turn, payload.answer.strip(), previous_turns)

    current_turn.answer = payload.answer.strip()
    current_turn.score = round(evaluation.score, 2)
    current_turn.feedback = evaluation.feedback
    current_turn.dimensions = {
        "scores": evaluation.dimensions,
        "answer_quality": evaluation.answer_quality,
        "strengths": evaluation.strengths,
        "weaknesses": evaluation.weaknesses,
    }
    session.difficulty = evaluation.suggested_difficulty

    next_turn_out: InterviewTurnOut | None = None
    interview_completed = current_turn.turn_index >= MAX_QUESTION_TURNS

    if interview_completed:
        summary = await summarize_session(profile, session, turns)
        session.status = "completed"
        session.overall_score = round(summary.overall_score, 2)
        session.summary = summary.summary
        session.strengths = summary.strengths
        session.weaknesses = summary.weaknesses
        session.finished_at = datetime.now(timezone.utc)
    else:
        next_question = await generate_next_question(profile, session, turns, evaluation)
        next_turn = InterviewTurn(
            session_id=session.id,
            turn_index=current_turn.turn_index + 1,
            question=next_question.question,
            question_type=next_question.question_type,
            skill_tag=next_question.skill_tag,
            difficulty=next_question.difficulty,
        )
        db.add(next_turn)

    await db.commit()
    session = await _get_session_with_turns_or_404(db, session.id)
    turns = _sort_turns(session)
    evaluated_turn = next(turn for turn in turns if turn.turn_index == current_turn.turn_index)
    pending_turn = next((turn for turn in turns if turn.answer is None), None)
    if pending_turn is not None:
        next_turn_out = InterviewTurnOut.model_validate(pending_turn)
    elif session.status != "completed":
        raise HTTPException(
            status_code=500,
            detail="Interview answer was saved but no next question is available for this session.",
        )

    return InterviewAnswerResponse(
        session=InterviewSessionOut.model_validate(session),
        evaluated_turn=InterviewTurnOut.model_validate(evaluated_turn),
        next_question=next_turn_out,
        interview_completed=session.status == "completed",
    )


@router.get("/{profile_id}/history", response_model=list[InterviewSessionOut])
async def interview_history(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[InterviewSessionOut]:
    await _get_profile_or_404(db, profile_id)
    query: Select[tuple[InterviewSession]] = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .where(InterviewSession.profile_id == profile_id)
        .order_by(InterviewSession.started_at.desc())
    )
    sessions = (await db.execute(query)).scalars().all()
    return [InterviewSessionOut.model_validate(session) for session in sessions]
