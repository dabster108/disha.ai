"""LangChain tool wrapping the one job-search implementation (app.rag.retriever).

Rule: no duplicate job-search logic — this and any future agent (chatbot,
roadmap) call search_jobs() through here, never re-query Chroma directly.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.rag.retriever import search_jobs


@tool
def search_jobs_tool(query: str, n: int = 20) -> list[dict]:
    """Search live Nepal job postings by role or skill query.

    Returns a list of jobs with title, company, location, required_skills,
    source_url, and similarity (0-1) for each match, ranked best first.
    """
    jobs = search_jobs(query, n=n)
    return [
        {
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "required_skills": job["required_skills"],
            "source_url": job["source_url"],
            "similarity": job["similarity"],
        }
        for job in jobs
    ]
