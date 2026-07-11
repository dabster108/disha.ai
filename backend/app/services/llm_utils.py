"""Shared helper for LLM calls that must return a structured (Pydantic) result.

Both Groq's small model and, less often, Mistral's occasionally emit a
malformed tool call under structured output (provider-side ``tool_use_failed``
400s). A single retry recovers most of these; callers fall back to a
deterministic template when both attempts fail so a flaky LLM response never
surfaces as a 500 to the student.
"""

from __future__ import annotations

import logging
from typing import TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


async def call_structured(llm: BaseChatModel, schema: type[T], prompt: str, *, attempts: int = 2) -> T | None:
    """Invoke ``llm`` for ``schema``, retrying once. Returns None if all attempts fail.

    A failed attempt is either a raised exception (malformed tool call) or a
    clean ``None`` return (the model responded without calling the tool at
    all) — both are retried the same way, since either can happen on an
    otherwise-healthy request and a second attempt usually succeeds.
    """
    structured = llm.with_structured_output(schema)
    for attempt in range(attempts):
        try:
            result = await structured.ainvoke(prompt)
        except Exception:
            logger.warning("Structured LLM call failed (attempt %s/%s)", attempt + 1, attempts, exc_info=True)
            result = None
        if result is not None:
            return result
        if result is None and attempt < attempts - 1:
            logger.info("Structured LLM returned no tool output (attempt %s/%s) — retrying", attempt + 1, attempts)
    return None
