from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

JobSource = Literal[
    "merojob",
    "jobaxle",
    "kumarijob",
    "jobsnepal",
    "jobejee",
    "merorojgari",
    "kamkhoj",
]


class JobPosting(BaseModel):
    id: str
    source: JobSource
    title: str
    company: str
    location: str
    required_skills: list[str] = Field(default_factory=list)
    salary_range: str
    source_url: str
    # Aggregator provenance (kamkhoj): where we discovered the job vs where it lives.
    aggregator: str | None = None
    original_source: str | None = None


class JobsFile(BaseModel):
    scraped_at: str
    sources: list[JobSource]
    jobs: list[JobPosting]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
