from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["roadmap"])


@router.post("/roadmap", status_code=501)
async def roadmap() -> None:
    raise HTTPException(status_code=501, detail="Roadmap generation lands in a later phase (steps 5-6).")
