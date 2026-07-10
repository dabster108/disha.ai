from __future__ import annotations

import argparse
import logging
from functools import lru_cache

import chromadb

from app.config import get_settings
from app.rag.documents import (
    _contains_term,
    is_non_technical_query,
    is_technical_query,
    normalize_search_query,
    role_category_match,
    skill_overlap_score,
    title_overlap_score,
)
from app.rag.embeddings import get_embedder

logger = logging.getLogger("disha.rag.retriever")


@lru_cache
def _collection() -> chromadb.Collection:
    """Chroma PersistentClient + collection handle, created once per process.

    `@lru_cache` on a no-arg function means every caller — including every
    request — gets back this same client/collection instead of re-opening
    the on-disk store. Warmed eagerly at startup by `warm_up()` below.
    """
    settings = get_settings()
    client = chromadb.PersistentClient(path=str(settings.chroma_path))
    embedder = get_embedder()
    collection = client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=embedder,
        metadata={"hnsw:space": "cosine", "embedding_model": settings.embedding_model},
    )
    logger.info("Chroma initialized.")
    return collection


def warm_up() -> None:
    """Force the embedding model + Chroma collection to load now, not on the
    first request. Call once from the FastAPI startup lifespan (app.main)."""
    _collection()


def _hybrid_score(
    *,
    semantic: float,
    query: str,
    title: str,
    skills: list[str],
    category: str,
) -> float:
    settings = get_settings()
    title_score = title_overlap_score(query, title)
    skill_score = skill_overlap_score(query, skills)
    category_score = role_category_match(query, category)
    score = (
        semantic
        + settings.job_search_title_boost * title_score
        + settings.job_search_skill_boost * skill_score
        + settings.job_search_category_boost * category_score
    )
    _NON_TECH_CATEGORIES = {
        "business", "finance", "banking", "marketing", "sales", "hr",
        "nursing", "healthcare", "education", "hospitality", "admin", "logistics", "ngo", "legal",
    }
    _TECH_CATEGORIES = {
        "backend", "frontend", "fullstack", "software", "tech", "ml_ai", "data", "devops", "mobile", "qa", "product", "design",
    }

    if is_technical_query(query) and not is_non_technical_query(query):
        if category == "general" and title_score == 0.0 and skill_score == 0.0:
            score -= 0.12
        if category in _TECH_CATEGORIES:
            score += 0.05
        query_lower = query.casefold()
        title_lower = title.casefold()
        wants_python_stack = any(
            _contains_term(query_lower, term)
            for term in ("python", "fastapi", "django", "backend", "flask")
        )
        if (
            wants_python_stack
            and _contains_term(title_lower, "php")
            and not _contains_term(query_lower, "php")
            and not _contains_term(title_lower, "python")
        ):
            score -= 0.15
    elif is_non_technical_query(query):
        if category in _NON_TECH_CATEGORIES:
            score += 0.08
        if category in _TECH_CATEGORIES and title_score == 0.0 and category_score == 0.0:
            score -= 0.10
    # semantic is already a similarity in [0,1], but the title/skill/category
    # boosts are additive bonuses layered on top and can push the sum past 1.0
    # (e.g. a strong semantic match plus every boost firing) — clamp to [0,1]
    # so this stays presentable as a percentage everywhere it's displayed.
    return round(min(1.0, max(0.0, score)), 4)


def search_jobs(
    query: str,
    n: int = 10,
    *,
    source: str | None = None,
    min_similarity: float | None = None,
    debug: bool = False,
) -> list[dict]:
    """Semantic + hybrid search over scraped job postings.

    Over-fetches from Chroma, reranks by title/skill/category overlap, then
    filters by ``min_similarity``. Returns fewer than ``n`` results when matches
    are weak — never pads with unrelated jobs.
    """
    settings = get_settings()
    threshold = settings.min_job_similarity if min_similarity is None else min_similarity
    collection = _collection()
    embedder = get_embedder()
    enriched_query = normalize_search_query(query)
    query_embedding = embedder.encode_query(enriched_query)

    total = collection.count()
    if total == 0:
        return []

    fetch_n = min(max(n * settings.job_search_overfetch, n), total)
    where = {"source": source} if source else None

    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=fetch_n,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    candidates: list[dict] = []
    ids = result["ids"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]
    documents = result["documents"][0]

    for job_id, meta, distance, document in zip(ids, metadatas, distances, documents):
        semantic = round(max(0.0, 1.0 - distance), 4)
        skills_raw = meta.get("required_skills", "")
        skills = [s.strip() for s in skills_raw.split(",") if s.strip()]
        title = meta.get("title", "")
        category = meta.get("role_category", "general")
        hybrid = _hybrid_score(
            semantic=semantic,
            query=query,
            title=title,
            skills=skills,
            category=category,
        )

        row = {
            "id": job_id,
            "source": meta.get("source"),
            "title": title,
            "company": meta.get("company"),
            "location": meta.get("location"),
            "required_skills": skills,
            "salary_range": meta.get("salary_range"),
            "source_url": meta.get("source_url"),
            "role_category": category,
            "similarity": hybrid,
            "semantic_similarity": semantic,
        }
        if debug:
            row["document"] = document
            row["debug"] = {
                "embedding_model": settings.embedding_model,
                "enriched_query": enriched_query,
                "title_overlap": round(title_overlap_score(query, title), 4),
                "skill_overlap": round(skill_overlap_score(query, skills), 4),
                "category_match": role_category_match(query, category),
                "hybrid_score": hybrid,
                "semantic_similarity": semantic,
                "metadata": meta,
            }
        candidates.append(row)

    candidates.sort(key=lambda row: row["similarity"], reverse=True)
    kept = [row for row in candidates if row["similarity"] >= threshold][:n]

    if debug:
        logger.info(
            "search_jobs query=%r enriched=%r model=%s fetched=%s kept=%s threshold=%.2f",
            query,
            enriched_query,
            settings.embedding_model,
            len(candidates),
            len(kept),
            threshold,
        )
        for rank, row in enumerate(kept, start=1):
            logger.info(
                "#%s score=%.3f semantic=%.3f title=%r company=%r",
                rank,
                row["similarity"],
                row["semantic_similarity"],
                row["title"],
                row["company"],
            )
            if row.get("document"):
                logger.info("  doc: %s", row["document"][:240].replace("\n", " | "))

    return kept


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Debug job semantic search")
    parser.add_argument("query", help='e.g. "Backend Developer Python FastAPI"')
    parser.add_argument("-n", type=int, default=5, help="Max results (default: 5)")
    parser.add_argument("--min-similarity", type=float, default=None)
    parser.add_argument("--debug", action="store_true", help="Log scores and document text")
    args = parser.parse_args()

    hits = search_jobs(
        args.query,
        n=args.n,
        min_similarity=args.min_similarity,
        debug=True if args.debug else False,
    )
    settings = get_settings()
    print(f"\nModel: {settings.embedding_model} | threshold: {args.min_similarity or settings.min_job_similarity}")
    print(f"Query: {args.query!r}\n")
    if not hits:
        print("No jobs above similarity threshold.")
        return
    for row in hits:
        print(
            f"{row['similarity']:.3f} (semantic {row['semantic_similarity']:.3f}) | "
            f"{row['title']} @ {row['company']} [{row['role_category']}]"
        )
        if args.debug:
            print(f"  skills: {', '.join(row['required_skills'][:8]) or 'n/a'}")
            print(f"  doc: {(row.get('document') or '')[:200].replace(chr(10), ' | ')}")


if __name__ == "__main__":
    main()
