from __future__ import annotations

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.config import get_settings


def build_async_url(database_url: str) -> tuple[URL, dict]:
    """Convert a Neon/psql-style URL into an asyncpg-compatible one.

    Neon connection strings carry ``sslmode=require&channel_binding=require``,
    which asyncpg rejects as query params — SSL must be passed via connect_args.
    """
    url = make_url(database_url)
    query = dict(url.query)
    sslmode = query.pop("sslmode", "require")
    query.pop("channel_binding", None)
    url = url.set(drivername="postgresql+asyncpg", query=query)
    connect_args = {} if sslmode == "disable" else {"ssl": "require"}
    return url, connect_args


_settings = get_settings()
_url, _connect_args = build_async_url(_settings.database_url)

engine: AsyncEngine = create_async_engine(
    _url,
    connect_args=_connect_args,
    # pool_pre_ping adds a full round-trip to Neon on every single checkout to
    # validate a connection that's almost always still fine — over a
    # long-haul link that round trip alone was ~0.5-1s per request. A
    # background keep-alive (see app.main's lifespan) pings the pool every two
    # minutes instead, so recycling/reconnects happen off the request path
    # rather than on a real user's request.
    pool_pre_ping=False,
    pool_recycle=1800,
    # Dashboard alone fires 4 parallel requests per load (React StrictMode can
    # double that in dev); a pool_size of 5 meant some of those regularly
    # spilled into disposable "overflow" connections, each paying the same
    # ~4-6s cold TLS handshake to Neon that a real pooled connection avoids.
    pool_size=10,
    max_overflow=10,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
