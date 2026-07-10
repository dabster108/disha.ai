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
    database_url: str
    mistral_api_key: str | None = None
    admin_api_key: str | None = None  # protects /api/admin/*; endpoints 503 when unset

    groq_model: str = "llama-3.1-8b-instant"
    # OCR 3 pinned explicitly — "mistral-ocr-latest" may route to OCR 4.
    mistral_ocr_model: str = "mistral-ocr-2512"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    min_job_similarity: float = 0.42
    job_search_overfetch: int = 4
    job_search_title_boost: float = 0.22
    job_search_skill_boost: float = 0.13
    job_search_category_boost: float = 0.10

    data_dir: Path = BACKEND_DIR / "data"
    jobs_file: Path = BACKEND_DIR / "data" / "jobs.json"
    chroma_path: Path = BACKEND_DIR / "data" / "chroma"
    chroma_collection: str = "nepal_jobs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
