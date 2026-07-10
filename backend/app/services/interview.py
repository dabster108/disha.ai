from __future__ import annotations

from typing import Literal

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.models import InterviewSession, InterviewTurn, StudentProfile

TRACK_TECH_ROLES = {
    "backend developer",
    "frontend developer",
    "full stack developer",
    "python developer",
    "ml engineer",
    "machine learning engineer",
    "data scientist",
    "data analyst",
    "software engineer",
    "devops engineer",
    "qa engineer",
}
TECH_SKILL_HINTS = {
    "python",
    "javascript",
    "typescript",
    "react",
    "node",
    "sql",
    "java",
    "django",
    "fastapi",
    "docker",
    "aws",
    "machine learning",
    "pandas",
    "tensorflow",
}
MAX_QUESTION_TURNS = 4


class AnswerEvaluation(BaseModel):
    score: float = Field(ge=0, le=10)
    feedback: str = Field(description="Short actionable feedback for the student.")
    dimensions: dict[str, float] = Field(
        default_factory=dict,
        description="Named scoring dimensions such as clarity, accuracy, depth, and relevance on a 0-10 scale.",
    )
    answer_quality: Literal["poor", "average", "good", "excellent"]
    suggested_difficulty: Literal["easy", "medium", "hard"]
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)


class NextQuestion(BaseModel):
    question: str
    question_type: Literal["opening", "technical", "conceptual", "scenario", "behavioral"]
    skill_tag: str | None = None
    difficulty: Literal["easy", "medium", "hard"]
    rationale: str = Field(description="Internal reason for the next question choice.")


class InterviewSummary(BaseModel):
    overall_score: float = Field(ge=0, le=10)
    summary: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)


def detect_track(profile: StudentProfile) -> Literal["tech", "nontech"]:
    role = (profile.target_role or "").strip().casefold()
    if role in TRACK_TECH_ROLES:
        return "tech"

    skill_keys = {(skill or "").strip().casefold() for skill in profile.skills}
    if skill_keys & TECH_SKILL_HINTS:
        return "tech"
    return "nontech"


def choose_initial_difficulty(profile: StudentProfile) -> Literal["easy", "medium", "hard"]:
    years = profile.years_of_experience or 0
    skill_count = len(profile.skills or [])
    role = (profile.target_role or "").casefold()

    if years >= 4 or "senior" in role or skill_count >= 10:
        return "hard"
    if years >= 1.5 or skill_count >= 5:
        return "medium"
    return "easy"


def build_welcome_message(profile: StudentProfile, track: str, difficulty: str) -> str:
    name = profile.full_name or "there"
    track_label = "technical" if track == "tech" else "role-specific"
    return (
        f"Welcome {name}! We’ll run a short adaptive {track_label} interview for the "
        f"`{profile.target_role}` role. I’ll start at `{difficulty}` difficulty, ask one "
        "question at a time, and adapt based on your answers and profile."
    )


def fallback_opening_question(profile: StudentProfile, difficulty: str) -> NextQuestion:
    return NextQuestion(
        question=(
            f"To begin, give me a brief overview of your background and why you are targeting "
            f"the {profile.target_role} role."
        ),
        question_type="opening",
        skill_tag=None,
        difficulty=difficulty,
        rationale="Start with a background question anchored to the candidate's target role.",
    )


def fallback_next_question(
    profile: StudentProfile,
    track: Literal["tech", "nontech"],
    turn_index: int,
    evaluation: AnswerEvaluation,
) -> NextQuestion:
    skills = profile.skills or []
    primary_skill = skills[0] if skills else None
    difficulty = evaluation.suggested_difficulty

    if track == "tech":
        if turn_index == 2:
            return NextQuestion(
                question=(
                    f"Pick one project or experience from your background and explain how you used "
                    f"{primary_skill or 'your strongest technical skill'} to solve a real problem."
                ),
                question_type="technical",
                skill_tag=primary_skill,
                difficulty=difficulty,
                rationale="Move from background into a concrete technical example.",
            )
        if evaluation.answer_quality in {"good", "excellent"}:
            return NextQuestion(
                question=(
                    f"Suppose you are working as a {profile.target_role}. Describe a more advanced "
                    f"design or debugging challenge involving {primary_skill or 'your core stack'} and how you would handle it."
                ),
                question_type="conceptual",
                skill_tag=primary_skill,
                difficulty=difficulty,
                rationale="Increase depth after a strong answer.",
            )
        return NextQuestion(
            question=(
                f"Let’s stay practical: walk through the key steps you would follow to complete a typical "
                f"{profile.target_role} task using {primary_skill or 'your current skills'}."
            ),
            question_type="technical",
            skill_tag=primary_skill,
            difficulty=difficulty,
            rationale="Keep the next technical question grounded after a weaker answer.",
        )

    if turn_index == 2:
        return NextQuestion(
            question=(
                f"Imagine you are working as a {profile.target_role}. Describe how you would handle a common "
                "day-to-day scenario in that role and what outcome you would aim for."
            ),
            question_type="scenario",
            skill_tag=None,
            difficulty=difficulty,
            rationale="Introduce a role-specific scenario for non-technical tracks.",
        )
    if evaluation.answer_quality in {"good", "excellent"}:
        return NextQuestion(
            question=(
                f"Tell me about a more challenging situation relevant to the {profile.target_role} role where "
                "you had to make a decision, manage pressure, or resolve a conflict."
            ),
            question_type="behavioral",
            skill_tag=None,
            difficulty=difficulty,
            rationale="Increase complexity after a strong scenario answer.",
        )
    return NextQuestion(
        question=(
            f"What practical steps would you take to perform well in your first few weeks as a {profile.target_role}, "
            "especially if you faced an unfamiliar situation?"
        ),
        question_type="scenario",
        skill_tag=None,
        difficulty=difficulty,
        rationale="Keep the follow-up practical and accessible after a weaker answer.",
    )


def fallback_evaluation(answer: str, current_difficulty: str) -> AnswerEvaluation:
    word_count = len(answer.split())
    if word_count >= 120:
        quality = "good"
        score = 7.5
        next_difficulty = "hard" if current_difficulty == "medium" else current_difficulty
    elif word_count >= 60:
        quality = "average"
        score = 6.0
        next_difficulty = "medium"
    else:
        quality = "poor"
        score = 4.0
        next_difficulty = "easy"

    return AnswerEvaluation(
        score=score,
        feedback="Add more concrete examples, clearer structure, and role-specific detail.",
        dimensions={"clarity": score, "relevance": score, "depth": max(score - 0.5, 0)},
        answer_quality=quality,
        suggested_difficulty=next_difficulty,
        strengths=["Stayed on topic"] if word_count >= 20 else [],
        weaknesses=["Answer was too brief"] if word_count < 60 else ["Could include more specifics"],
    )


def build_profile_context(profile: StudentProfile) -> str:
    education = ", ".join(
        filter(None, [f"{entry.get('degree')} at {entry.get('institution')}" for entry in profile.education or []])
    )
    experience = ", ".join(
        filter(None, [f"{entry.get('title')} at {entry.get('company')}" for entry in profile.experience or []])
    )
    return (
        f"Target role: {profile.target_role}\n"
        f"Summary: {profile.summary or 'N/A'}\n"
        f"Years of experience: {profile.years_of_experience or 0}\n"
        f"Skills: {', '.join(profile.skills or []) or 'N/A'}\n"
        f"Education: {education or 'N/A'}\n"
        f"Experience: {experience or 'N/A'}"
    )


def build_turn_context(turns: list[InterviewTurn]) -> str:
    if not turns:
        return "No previous turns."

    parts: list[str] = []
    for turn in turns:
        parts.append(
            "\n".join(
                [
                    f"Turn {turn.turn_index}",
                    f"Question type: {turn.question_type}",
                    f"Question: {turn.question}",
                    f"Answer: {turn.answer or 'N/A'}",
                    f"Score: {turn.score if turn.score is not None else 'N/A'}",
                    f"Feedback: {turn.feedback or 'N/A'}",
                ]
            )
        )
    return "\n\n".join(parts)


def _llm() -> ChatGroq:
    settings = get_settings()
    return ChatGroq(model=settings.groq_model, temperature=0.2, api_key=settings.groq_api_key)


async def generate_opening_question(profile: StudentProfile, track: str, difficulty: str) -> NextQuestion:
    prompt = (
        "You are generating the first interview question for an adaptive mock interview.\n"
        "Return exactly one opening question.\n"
        "Keep it concise, professional, and role-specific.\n"
        "The first question must be a background question, not a coding exercise.\n\n"
        f"Track: {track}\n"
        f"Difficulty: {difficulty}\n"
        f"Candidate profile:\n{build_profile_context(profile)}"
    )
    try:
        return await _llm().with_structured_output(NextQuestion).ainvoke(prompt)
    except Exception:
        return fallback_opening_question(profile, difficulty)


async def evaluate_answer(
    profile: StudentProfile,
    session: InterviewSession,
    current_turn: InterviewTurn,
    answer: str,
    previous_turns: list[InterviewTurn],
) -> AnswerEvaluation:
    prompt = (
        "You are evaluating one answer from a short adaptive interview.\n"
        "Score the answer from 0 to 10.\n"
        "Be strict but fair.\n"
        "Use the candidate's profile and the exact question context.\n"
        "Set suggested_difficulty based on the demonstrated answer quality.\n\n"
        f"Session track: {session.track}\n"
        f"Current session difficulty: {session.difficulty}\n"
        f"Candidate profile:\n{build_profile_context(profile)}\n\n"
        f"Previous turns:\n{build_turn_context(previous_turns)}\n\n"
        f"Current question:\n{current_turn.question}\n\n"
        f"Candidate answer:\n{answer}"
    )
    try:
        return await _llm().with_structured_output(AnswerEvaluation).ainvoke(prompt)
    except Exception:
        return fallback_evaluation(answer, current_turn.difficulty)


async def generate_next_question(
    profile: StudentProfile,
    session: InterviewSession,
    turns: list[InterviewTurn],
    evaluation: AnswerEvaluation,
) -> NextQuestion:
    current_turn = turns[-1]
    next_turn_index = current_turn.turn_index + 1
    prompt = (
        "You are generating the next interview question for a short adaptive mock interview.\n"
        "The next question must depend on the candidate's profile, target role, claimed skills, and the quality of the previous answer.\n"
        "Do not ask for code execution.\n"
        "Ask one concise question only.\n"
        "For technical tracks, use technical or conceptual questions after the opening.\n"
        "For non-technical tracks, use scenario or behavioral questions after the opening.\n\n"
        f"Session track: {session.track}\n"
        f"Current session difficulty: {session.difficulty}\n"
        f"Next turn index: {next_turn_index}\n"
        f"Latest evaluation: {evaluation.model_dump_json()}\n\n"
        f"Candidate profile:\n{build_profile_context(profile)}\n\n"
        f"Interview so far:\n{build_turn_context(turns)}"
    )
    try:
        return await _llm().with_structured_output(NextQuestion).ainvoke(prompt)
    except Exception:
        return fallback_next_question(profile, session.track, next_turn_index, evaluation)


async def summarize_session(
    profile: StudentProfile,
    session: InterviewSession,
    turns: list[InterviewTurn],
) -> InterviewSummary:
    prompt = (
        "You are writing the final result for a short adaptive interview.\n"
        "Use all answered turns to produce an overall score, a concise summary, strengths, and weaknesses.\n"
        "The result should help the student understand what to improve next.\n\n"
        f"Session track: {session.track}\n"
        f"Session target role: {session.target_role}\n"
        f"Candidate profile:\n{build_profile_context(profile)}\n\n"
        f"Interview transcript:\n{build_turn_context(turns)}"
    )
    try:
        return await _llm().with_structured_output(InterviewSummary).ainvoke(prompt)
    except Exception:
        scores = [turn.score for turn in turns if turn.score is not None]
        overall = round(sum(scores) / max(len(scores), 1), 2)
        return InterviewSummary(
            overall_score=overall,
            summary=(
                f"You completed an adaptive interview for the {profile.target_role} role. "
                "Keep improving answer depth, structure, and role-specific examples."
            ),
            strengths=["Stayed relevant to the role"] if overall >= 5 else [],
            weaknesses=["Needs more concrete examples and clearer explanation"],
        )
