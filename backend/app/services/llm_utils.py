"""Shared helper for LLM calls that must return a structured (Pydantic) result.

Both Groq's small model and, less often, Mistral's occasionally emit a
malformed tool call under structured output (provider-side ``tool_use_failed``
400s). A single retry recovers most of these; callers fall back to a
deterministic template when both attempts fail so a flaky LLM response never
surfaces as a 500 to the student.
"""

from __future__ import annotations

from typing import TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


async def call_structured(llm: BaseChatModel, schema: type[T], prompt: str, *, attempts: int = 2) -> T | None:
    """Invoke ``llm`` for ``schema``, retrying once. Returns None if all attempts fail."""
    structured = llm.with_structured_output(schema)
    for attempt in range(attempts):
        try:
            return await structured.ainvoke(prompt)
        except Exception:
            if attempt == attempts - 1:
                return None
    return None
