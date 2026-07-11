"""Canonical skills catalog endpoints — backs the frontend SkillPicker so
onboarding, CV review, and practice all draw from the same fixed skill list
per role instead of free text.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.skills_catalog import aliases, all_skills, load_catalog, skills_for_role

router = APIRouter(prefix="/api/skills", tags=["skills"])


class SkillsCatalogResponse(BaseModel):
    version: int
    roles: dict[str, list[str]]
    global_skills: list[str]
    all_skills: list[str]
    aliases: dict[str, str]


class SkillsByRoleResponse(BaseModel):
    role: str
    skills: list[str]


@router.get("", response_model=SkillsCatalogResponse)
async def get_catalog() -> dict:
    catalog = load_catalog()
    return {
        "version": catalog.version,
        "roles": {name: data.get("skills", []) for name, data in catalog.roles.items()},
        "global_skills": catalog.global_skills,
        "all_skills": all_skills(),
        "aliases": aliases(),
    }


@router.get("/by-role", response_model=SkillsByRoleResponse)
async def get_skills_by_role(role: str | None = None) -> dict:
    if not role or not role.strip():
        raise HTTPException(status_code=422, detail="Query param 'role' is required")
    return {"role": role, "skills": skills_for_role(role)}
