from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def get_current_user() -> None:
    # Auth stub — replaced when signup/login lands. Returning None means
    # "anonymous"; routes that need a user should 401 on None.
    return None
