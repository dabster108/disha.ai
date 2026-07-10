"""Disha AI backend — single FastAPI server.

Run with: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly load the embedding model + Chroma collection before serving any
    # request — otherwise the first search (per process) pays the load cost.
    from app.rag.retriever import warm_up

    warm_up()
    yield


app = FastAPI(
    title="Disha AI",
    description="Agentic career platform for Nepali students — skill gap analysis and roadmaps grounded in live Nepal job-market data.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
