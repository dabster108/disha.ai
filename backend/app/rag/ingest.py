"""Ingest data/jobs.json into the Chroma vector store.

Usage:
    python -m app.rag.ingest [--reset]
"""

from __future__ import annotations

import argparse
import json

import chromadb
from chromadb.utils import embedding_functions

from app.config import get_settings
from scraper.models import JobPosting, JobsFile


def job_to_document(job: JobPosting) -> str:
    """One chunk per job: a job posting is small enough to embed whole."""
    skills = ", ".join(job.required_skills) if job.required_skills else "not specified"
    return (
        f"{job.title} at {job.company}. "
        f"Location: {job.location}. "
        f"Required skills: {skills}. "
        f"Salary: {job.salary_range}."
    )


def job_to_metadata(job: JobPosting) -> dict:
    return {
        "source": job.source,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "required_skills": ", ".join(job.required_skills),
        "salary_range": job.salary_range,
        "source_url": job.source_url,
    }


def get_collection(*, reset: bool = False) -> chromadb.Collection:
    settings = get_settings()
    client = chromadb.PersistentClient(path=str(settings.chroma_path))
    embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.embedding_model,
    )
    if reset:
        try:
            client.delete_collection(settings.chroma_collection)
        except Exception:
            pass
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=embedder,
        metadata={"hnsw:space": "cosine"},
    )


def ingest(*, reset: bool = False) -> int:
    settings = get_settings()
    if not settings.jobs_file.exists():
        raise FileNotFoundError(
            f"{settings.jobs_file} not found — run `python -m scraper.run` first."
        )

    jobs_file = JobsFile.model_validate(json.loads(settings.jobs_file.read_text(encoding="utf-8")))
    collection = get_collection(reset=reset)

    jobs = jobs_file.jobs
    collection.upsert(
        ids=[job.id for job in jobs],
        documents=[job_to_document(job) for job in jobs],
        metadatas=[job_to_metadata(job) for job in jobs],
    )
    return len(jobs)


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed data/jobs.json into Chroma")
    parser.add_argument("--reset", action="store_true", help="Drop and rebuild the collection")
    args = parser.parse_args()

    count = ingest(reset=args.reset)
    settings = get_settings()
    print(f"Ingested {count} jobs into Chroma collection '{settings.chroma_collection}' at {settings.chroma_path}")


if __name__ == "__main__":
    main()
