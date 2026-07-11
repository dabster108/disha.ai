"""Disha AI backend — single FastAPI server.

Run with: uvicorn app.main:app --reload
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router

logger = logging.getLogger("disha.main")

DB_KEEPALIVE_INTERVAL_SECONDS = 120


async def _db_keepalive() -> None:
    """Ping the DB pool every 2 minutes.

    Neon's remote Postgres is a long-haul connection (~0.5-1s per round
    trip) and its compute auto-suspends after a few idle minutes — either
    one turns a real user's request into a multi-second cold start. Pinging
    on a background loop keeps both the pool's connections and Neon's
    compute warm, so that cost lands here instead of on a request.
    """
    from app.db.session import engine

    while True:
        try:
            await asyncio.sleep(DB_KEEPALIVE_INTERVAL_SECONDS)
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("DB keep-alive ping failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly load the embedding model + Chroma collection before serving any
    # request — otherwise the first search (per process) pays the load cost.
    from app.rag.retriever import warm_up

    warm_up()
    keepalive_task = asyncio.create_task(_db_keepalive())
    try:
        yield
    finally:
        keepalive_task.cancel()


app = FastAPI(
    title="Disha AI",
    description="Agentic career platform for Nepali students — skill gap analysis and roadmaps grounded in live Nepal job-market data.",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow localhost, loopback, and private LAN IPs so Next.js "Network" URLs
# (e.g. http://192.168.x.x:3000) can reach the API during local dev.
_DEV_ORIGIN_REGEX = (
    r"https?://("
    r"localhost"
    r"|127\.0\.0\.1"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=_DEV_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
