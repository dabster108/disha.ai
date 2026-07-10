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
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
