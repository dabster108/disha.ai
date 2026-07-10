from __future__ import annotations

from functools import lru_cache

import chromadb
from chromadb.utils import embedding_functions

from app.config import get_settings


@lru_cache
def _collection() -> chromadb.Collection:
    settings = get_settings()
    client = chromadb.PersistentClient(path=str(settings.chroma_path))
    embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.embedding_model,
    )
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=embedder,
        metadata={"hnsw:space": "cosine"},
    )


def search_jobs(
    query: str,
    n: int = 10,
    *,
    source: str | None = None,
) -> list[dict]:
    """Semantic search over scraped job postings.

    Returns a list of dicts with the normalized job fields plus a
    ``similarity`` score in [0, 1] (cosine).
    """
    collection = _collection()
    where = {"source": source} if source else None
    result = collection.query(
        query_texts=[query],
        n_results=min(n, max(collection.count(), 1)),
        where=where,
    )

    jobs: list[dict] = []
    ids = result["ids"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]
    for job_id, meta, distance in zip(ids, metadatas, distances):
        skills = meta.get("required_skills", "")
        jobs.append(
            {
                "id": job_id,
                "source": meta.get("source"),
                "title": meta.get("title"),
                "company": meta.get("company"),
                "location": meta.get("location"),
                "required_skills": [s.strip() for s in skills.split(",") if s.strip()],
                "salary_range": meta.get("salary_range"),
                "source_url": meta.get("source_url"),
                "similarity": round(1.0 - distance, 4),
            }
        )
    return jobs
