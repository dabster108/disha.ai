"""Ingest data/jobs.json into the Chroma vector store.

Usage:
    python -m app.rag.ingest [--reset]
"""

from __future__ import annotations

import argparse
import json
import logging

import chromadb

from app.config import get_settings
from app.rag.documents import job_to_document, job_to_metadata
from app.rag.embeddings import get_embedder
from scraper.models import JobsFile

logger = logging.getLogger("disha.rag.ingest")


def get_collection(*, reset: bool = False) -> chromadb.Collection:
    settings = get_settings()
    client = chromadb.PersistentClient(path=str(settings.chroma_path))
    embedder = get_embedder()
    if reset:
        try:
            client.delete_collection(settings.chroma_collection)
        except Exception:
            pass
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=embedder,
        metadata={"hnsw:space": "cosine", "embedding_model": settings.embedding_model},
    )


def ingest(*, reset: bool = False) -> int:
    settings = get_settings()
    if not settings.jobs_file.exists():
        raise FileNotFoundError(
            f"{settings.jobs_file} not found — run `python -m scraper.run` first."
        )

    jobs_file = JobsFile.model_validate(json.loads(settings.jobs_file.read_text(encoding="utf-8")))
    collection = get_collection(reset=reset)
    embedder = get_embedder()

    jobs = jobs_file.jobs
    documents = [job_to_document(job) for job in jobs]
    metadatas = [job_to_metadata(job) for job in jobs]
    embeddings = embedder.encode_documents(documents)

    collection.upsert(
        ids=[job.id for job in jobs],
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )

    logger.info(
        "Ingested %s jobs with model=%s into %s",
        len(jobs),
        settings.embedding_model,
        settings.chroma_collection,
    )
    return len(jobs)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Embed data/jobs.json into Chroma")
    parser.add_argument("--reset", action="store_true", help="Drop and rebuild the collection")
    args = parser.parse_args()

    count = ingest(reset=args.reset)
    settings = get_settings()
    print(
        f"Ingested {count} jobs into Chroma collection '{settings.chroma_collection}' "
        f"at {settings.chroma_path} (model: {settings.embedding_model})"
    )


if __name__ == "__main__":
    main()
