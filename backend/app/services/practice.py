"""Skill-practice / game logic: track detection, challenge generation, evaluation.

Mirrors app/services/interview.py (Groq structured output + graceful fallbacks)
but is skill-scoped rather than whole-profile adaptive Q&A. One challenge per
selected skill; each is scored 0-10 and passes at the configured threshold.

Groq only — no code execution in this MVP (AI review of submitted code/answer).
The API is shaped so a sandboxed test runner can slot in later.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.models import StudentProfile
from app.services.llm_utils import call_structured
from app.services.skills_catalog import filter_to_catalog, skills_for_role
from scraper.normalize import TECH_KEYWORDS

# Tech role names (whole-string match) reused/aligned with the interview service.
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
    "software developer",
    "devops engineer",
    "qa engineer",
    "mobile developer",
    "android developer",
    "ios developer",
}
# scraper.TECH_KEYWORDS is a broad *job-skills* list — it also carries soft/
# business skills (communication, digital marketing, seo, accounting, …). For
# TRACK detection we want genuinely technical skills only, so subtract those.
_NON_TECH_KEYWORDS = {
    "excel", "power bi", "tableau", "salesforce", "figma", "photoshop", "illustrator",
    "seo", "digital marketing", "content writing", "communication", "negotiation",
    "accounting", "tally", "sap", "project management", "agile", "scrum",
}
_TECH_SKILLS = {kw.casefold() for kw in TECH_KEYWORDS} - _NON_TECH_KEYWORDS
# Skills whose natural challenge is a coding task vs a written/pseudo-code answer.
_CODING_LANGS = {
    "python": "python",
    "fastapi": "python",
    "django": "python",
    "flask": "python",
    "pandas": "python",
    "javascript": "javascript",
    "typescript": "javascript",
    "react": "javascript",
    "node.js": "javascript",
    "nodejs": "javascript",
    "vue": "javascript",
    "sql": "sql",
    "mysql": "sql",
    "postgresql": "sql",
    "mongodb": "javascript",
    "java": "java",
}


def detect_track(target_role: str, skills: list[str]) -> Literal["tech", "nontech"]:
    """Prefer tech when the role is technical or any selected skill is a tech skill."""
    role = (target_role or "").strip().casefold()
    if role in TRACK_TECH_ROLES or any(word in role for word in ("developer", "engineer", "programmer", "data scien")):
        return "tech"
    skill_keys = {(skill or "").strip().casefold() for skill in skills}
    if skill_keys & _TECH_SKILLS:
        return "tech"
    return "nontech"


def language_for_skill(skill: str) -> str | None:
    return _CODING_LANGS.get((skill or "").strip().casefold())


def choose_difficulty(profile: StudentProfile) -> Literal["easy", "medium", "hard"]:
    years = profile.years_of_experience or 0
    role = (profile.target_role or "").casefold()
    if years >= 2 or "senior" in role or "lead" in role:
        return "hard"
    if years >= 1:
        return "medium"
    return "easy"


def adapt_difficulty(previous_score: float) -> Literal["easy", "medium", "hard"]:
    """Difficulty for the next challenge, based on how the last one scored."""
    if previous_score < 5:
        return "easy"
    if previous_score <= 7:
        return "medium"
    return "hard"


def skill_level_for_score(score: float) -> Literal["weak", "partial", "strong"]:
    """Verified skill level, derived from score so it never contradicts it."""
    if score >= 7:
        return "strong"
    if score >= 4:
        return "partial"
    return "weak"


def suggest_skills(profile: StudentProfile, *, limit: int = 5) -> tuple[list[str], str]:
    """Skills to practise: the student's claimed skills (catalog-normalized),
    tech skills first for tech tracks — falling back to the target role's
    catalog skills when the profile has nothing that maps to the catalog."""
    track = detect_track(profile.target_role, profile.skills or [])
    skills = filter_to_catalog(profile.skills or [])

    if not skills:
        skills = skills_for_role(profile.target_role)[:limit]
        return skills, track

    if track == "tech":
        tech = [s for s in skills if s.casefold() in _TECH_SKILLS]
        other = [s for s in skills if s.casefold() not in _TECH_SKILLS]
        ordered = tech + other
    else:
        ordered = skills

    # De-dupe preserving order.
    seen: set[str] = set()
    unique = [s for s in ordered if not (s.casefold() in seen or seen.add(s.casefold()))]
    return unique[:limit], track


# --------------------------------------------------------------------------
# Structured output schemas
# --------------------------------------------------------------------------


class CodingChallenge(BaseModel):
    prompt: str = Field(description="Short, practical coding task (15-30 min), Nepal-job-relevant.")
    starter_code: str | None = Field(None, description="Optional skeleton to start from.")
    expected_language: str = Field(description="python | javascript | sql")
    skill_tag: str
    difficulty: Literal["easy", "medium", "hard"]
    evaluation_hints: list[str] = Field(
        default_factory=list,
        description="What a good answer should include — used later to grade.",
    )


class ScenarioChallenge(BaseModel):
    prompt: str = Field(description="Situational question tied to the skill and target role.")
    skill_tag: str
    difficulty: Literal["easy", "medium", "hard"]
    what_good_answer_includes: list[str] = Field(default_factory=list)


class ChallengeEvaluation(BaseModel):
    score: float = Field(ge=0, le=10)
    dimensions: dict[str, float] = Field(
        default_factory=dict,
        description="Named 0-10 scores, e.g. correctness, logic, code_quality, edge_cases, explanation.",
    )
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    feedback: str
    verified_skill_level: Literal["weak", "partial", "strong"]


class PracticeSummaryResult(BaseModel):
    summary: str = Field(description="2-3 sentence feedback on the whole session.")


@lru_cache
def _llm() -> ChatGroq:
    settings = get_settings()
    return ChatGroq(model=settings.practice_groq_model, temperature=0.2, api_key=settings.groq_api_key)


async def _structured(schema, prompt: str, *, attempts: int = 2):
    return await call_structured(_llm(), schema, prompt, attempts=attempts)


def profile_context(profile: StudentProfile) -> str:
    return (
        f"Target role: {profile.target_role}\n"
        f"Years of experience: {profile.years_of_experience or 0}\n"
        f"Skills: {', '.join(profile.skills or []) or 'N/A'}\n"
        f"Summary: {profile.summary or 'N/A'}"
    )


# --------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------


async def generate_coding_challenge(
    profile: StudentProfile, skill: str, difficulty: str
) -> CodingChallenge:
    language = language_for_skill(skill) or "python"
    prompt = (
        "You are generating ONE short, practical coding challenge to test a single skill.\n"
        "Rules: 15-30 minutes of work, not LeetCode-hard; it must test the specific skill; "
        "make it relevant to real Nepali tech jobs. Provide a minimal starter_code skeleton.\n"
        f"expected_language must be '{language}'.\n\n"
        f"Skill to test: {skill}\n"
        f"Difficulty: {difficulty}\n"
        f"Candidate profile:\n{profile_context(profile)}"
    )
    challenge = await _structured(CodingChallenge, prompt)
    if challenge is None:
        return fallback_coding_challenge(skill, difficulty, language)
    challenge.skill_tag = skill
    challenge.difficulty = difficulty  # type: ignore[assignment]
    if not challenge.expected_language:
        challenge.expected_language = language
    return challenge


async def generate_scenario_challenge(
    profile: StudentProfile, skill: str, difficulty: str
) -> ScenarioChallenge:
    prompt = (
        "You are generating ONE situational challenge to test a single non-technical skill.\n"
        "Tie it to the skill, the target role, and the candidate's experience. One question only.\n\n"
        f"Skill to test: {skill}\n"
        f"Difficulty: {difficulty}\n"
        f"Candidate profile:\n{profile_context(profile)}"
    )
    challenge = await _structured(ScenarioChallenge, prompt)
    if challenge is None:
        return fallback_scenario_challenge(profile, skill, difficulty)
    challenge.skill_tag = skill
    challenge.difficulty = difficulty  # type: ignore[assignment]
    return challenge


def fallback_coding_challenge(skill: str, difficulty: str, language: str) -> CodingChallenge:
    return CodingChallenge(
        prompt=(
            f"Write a small {language} function that demonstrates your {skill} skill. "
            f"Solve a realistic task a {skill} developer would face on the job, handle edge cases, "
            "and keep the code clean and readable."
        ),
        starter_code=f"# Write your {language} solution below\n" if language == "python" else None,
        expected_language=language,
        skill_tag=skill,
        difficulty=difficulty,  # type: ignore[arg-type]
        evaluation_hints=[
            "Correctly solves the stated task",
            "Handles edge cases",
            "Readable, idiomatic code",
        ],
    )


def fallback_scenario_challenge(profile: StudentProfile, skill: str, difficulty: str) -> ScenarioChallenge:
    return ScenarioChallenge(
        prompt=(
            f"Describe a realistic situation as a {profile.target_role} where strong {skill} mattered. "
            "Explain what you did, why, and the outcome you aimed for."
        ),
        skill_tag=skill,
        difficulty=difficulty,  # type: ignore[arg-type]
        what_good_answer_includes=[
            f"Concrete example showing {skill}",
            "Clear reasoning and structure",
            "A measurable or realistic outcome",
        ],
    )


# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------


async def evaluate_submission(
    *,
    skill: str,
    difficulty: str,
    challenge_type: str,
    prompt: str,
    evaluation_hints: list[str],
    code: str | None,
    explanation: str | None,
    answer: str | None,
) -> ChallengeEvaluation:
    if challenge_type == "coding":
        submission = f"Submitted code:\n{code or '(none)'}\n\nExplanation:\n{explanation or '(none)'}"
        rubric = "correctness, logic, code_quality, edge_cases, explanation"
    else:
        submission = f"Submitted answer:\n{answer or '(none)'}"
        rubric = "relevance, structure, depth, communication"

    eval_prompt = (
        "You are grading ONE skill-practice submission. Score 0-10, strict but fair.\n"
        f"Provide dimension scores for: {rubric}.\n"
        "Set verified_skill_level: strong (>=7), partial (4-6.9), weak (<4).\n\n"
        f"Skill under test: {skill}\n"
        f"Difficulty: {difficulty}\n"
        f"Challenge prompt:\n{prompt}\n\n"
        f"What a good answer includes: {', '.join(evaluation_hints) or 'N/A'}\n\n"
        f"{submission}"
    )
    evaluation = await _structured(ChallengeEvaluation, eval_prompt)
    if evaluation is None:
        return fallback_evaluation(challenge_type, code, explanation, answer)
    return evaluation


def fallback_evaluation(
    challenge_type: str, code: str | None, explanation: str | None, answer: str | None
) -> ChallengeEvaluation:
    if challenge_type == "coding":
        body = (code or "").strip()
        length = len(body.splitlines())
        has_logic = any(tok in body for tok in ("def ", "function", "select", "return", "=>", "for ", "if "))
        if length >= 5 and has_logic:
            score, level = 6.5, "partial"
        elif body:
            score, level = 4.0, "partial"
        else:
            score, level = 1.0, "weak"
    else:
        words = len((answer or "").split())
        if words >= 120:
            score, level = 7.0, "strong"
        elif words >= 50:
            score, level = 5.5, "partial"
        elif words:
            score, level = 3.5, "weak"
        else:
            score, level = 1.0, "weak"

    return ChallengeEvaluation(
        score=score,
        dimensions={"overall": score},
        strengths=["Made a genuine attempt"] if score >= 4 else [],
        weaknesses=["Add more depth, correctness, and detail"],
        feedback="Automated fallback grade (AI grader unavailable). Add more complete, correct, well-explained work.",
        verified_skill_level=level,  # type: ignore[arg-type]
    )


async def summarize_session(
    profile: StudentProfile,
    skill_scores: dict[str, float],
    strong: list[str],
    weak: list[str],
) -> str:
    prompt = (
        "Write 2-3 sentences of encouraging, specific feedback for a skill-practice session.\n"
        "Mention which skills are verified strong and which need work, and one next step.\n\n"
        f"Target role: {profile.target_role}\n"
        f"Skill scores (0-10): {skill_scores}\n"
        f"Strong: {strong or 'none'}\n"
        f"Weak: {weak or 'none'}"
    )
    result = await _structured(PracticeSummaryResult, prompt)
    if result is not None:
        return result.summary

    # Fallback summary when Groq is unavailable.
    if strong and weak:
        return (
            f"You verified strong {', '.join(strong)} for the {profile.target_role} path, "
            f"while {', '.join(weak)} still need work. Focus your next practice on the weaker skills."
        )
    if strong:
        return f"Solid session — you verified {', '.join(strong)}. Keep practising to raise the difficulty."
    return (
        f"This session flagged {', '.join(weak) or 'several skills'} as areas to improve for the "
        f"{profile.target_role} path. Practise these and retry to verify progress."
    )
