from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["skill-gap"])


@router.post("/gap", status_code=501)
async def skill_gap() -> None:
    # Wired in the next phase, after Chroma retrieval and profiles are
    # confirmed working. The underlying logic already exists in
    # app/services/skill_gap.py and runs via the LangGraph gap node.
    raise HTTPException(status_code=501, detail="Skill gap endpoint lands in the next phase.")
