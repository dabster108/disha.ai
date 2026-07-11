from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: str
    # Separate Groq key for voice STT (Whisper) — keeps STT quota distinct from CV/practice.
    groq_api_key2: str | None = None
    # Turbo is ~2-4x faster than whisper-large-v3 with near-identical accuracy —
    # meaningfully cuts STT latency in the voice interview loop.
    groq_whisper_model: str = "whisper-large-v3-turbo"
    database_url: str
    mistral_api_key: str | None = None
    # Separate key for the interview LLM (distinct quota from the OCR key above).
    # Groq's small model intermittently emits malformed tool calls under
    # structured output; Mistral is steadier for the interview's multi-field schemas.
    mistral_api_key2: str | None = None
    # Separate key/quota for learning-curriculum generation (app/services/learning_agent.py).
    # Falls back to mistral_api_key2 if unset, so the feature still works before a
    # dedicated key is provisioned — just sharing that quota instead of its own.
    mistral_api_key3: str | None = None
    learning_mistral_model: str = "mistral-small-latest"
    admin_api_key: str | None = None  # protects /api/admin/*; endpoints 503 when unset
    google_application_credentials: str | None = None
    google_tts_language_code: str = "en-US"
    google_tts_voice_name: str = "en-US-Standard-C"
    google_tts_audio_encoding: str = "MP3"
    google_stt_language_code: str = "en-US"
    # Default TTS when Google Cloud credentials are not set (Microsoft neural via edge-tts).
    edge_tts_voice: str = "en-US-JennyNeural"

    groq_model: str = "llama-3.1-8b-instant"
    # OCR 3 pinned explicitly — "mistral-ocr-latest" may route to OCR 4.
    mistral_ocr_model: str = "mistral-ocr-2512"
    interview_mistral_model: str = "mistral-small-latest"

    # Skill-practice / game mode
    practice_pass_threshold: float = 7.0
    practice_max_skills_per_session: int = 3
    practice_groq_model: str = "llama-3.1-8b-instant"

    # Unified skill gap agent
    gap_n_jobs: int = 20
    gap_include_narrative_default: bool = True
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    min_job_similarity: float = 0.42
    job_search_overfetch: int = 4
    job_search_title_boost: float = 0.22
    job_search_skill_boost: float = 0.13
    job_search_category_boost: float = 0.10
    # For a technical (IT) query, how hard to push down a posting whose TITLE is
    # clearly non-technical (sales/nurse/receptionist/civil-engineer) even if its
    # scraped skills carry noisy tech tokens. Defense-in-depth on top of the
    # role-category classifier so a mis-tagged posting can't rank for an IT role.
    job_search_nontech_title_penalty: float = 0.30
    # When aggregating market demand for a technical target role, ignore
    # postings whose role_category is non-technical (their skills are noise for
    # an IT student), and drop generic soft-skill entries from the demand tally.
    gap_tech_demand_tech_jobs_only: bool = True
    gap_tech_demand_drop_soft_skills: bool = True

    # Multi-factor job matching
    job_match_max_results: int = 8
    job_match_retrieval_min_similarity: float = 0.38
    job_match_min_role_similarity: float = 0.45
    job_match_min_skill_overlap: float = 0.15
    job_match_min_domain_alignment: float = 0.40
    job_match_min_composite: float = 0.55
    job_match_skills_weight: float = 0.28
    job_match_role_weight: float = 0.22
    job_match_experience_weight: float = 0.12
    job_match_seniority_weight: float = 0.12
    job_match_domain_weight: float = 0.12
    job_match_education_weight: float = 0.06
    job_match_location_weight: float = 0.04
    job_match_career_goal_weight: float = 0.04

    data_dir: Path = BACKEND_DIR / "data"
    jobs_file: Path = BACKEND_DIR / "data" / "jobs.json"
    chroma_path: Path = BACKEND_DIR / "data" / "chroma"
    chroma_collection: str = "nepal_jobs"

    # Synthetic Recommendation Lab — a public benchmark dataset, NOT live
    # Nepal job postings. See app/services/synthetic_recommender.py.
    synthetic_dataset_file: Path = BACKEND_DIR / "datasets" / "Job Datsset.csv"

    # MCP-discovered learning media (app/services/mcp_client.py). Off by
    # default: the Learning panel works fine on the curated catalog alone —
    # MCP only adds Context7 docs + web-searched YouTube on top of it.
    mcp_enabled: bool = False
    mcp_timeout_seconds: float = 8.0
    # Prefer remote HTTP/SSE servers when a URL is set; otherwise fall back to
    # spawning the server locally via stdio (command + args, e.g. npx/uvx).
    mcp_duckduckgo_url: str | None = None
    mcp_duckduckgo_command: str | None = None
    mcp_duckduckgo_args: list[str] = []
    mcp_context7_url: str | None = None
    mcp_context7_command: str | None = None
    mcp_context7_args: list[str] = []
    # Sent as CONTEXT7_API_KEY on streamable_http requests — bills against your
    # account quota instead of the shared anonymous pool.
    mcp_context7_api_key: str | None = None

    # Roadmap generation: master JSON roadmaps by default. Set ROADMAP_USE_LLM=true
    # to roll back to Groq-authored plans (generate_roadmap / generate_skill_path).
    roadmap_use_llm: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
