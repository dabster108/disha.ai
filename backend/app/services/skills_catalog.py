"""Canonical skills catalog — the single source of truth for "what skills
exist" and "what does this role need" across onboarding, CV parsing,
practice suggestions, skill-gap matching, and job matching.

Every place in the app that reads or writes a skill name should normalize
it through here first, so "ReactJS"/"React.js"/"React" all collapse to one
canonical form everywhere.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CATALOG_FILE = Path(__file__).resolve().parents[1] / "data" / "skills_catalog.json"

# Aliases for common variant spellings -> the catalog's canonical display name.
# Keys are casefolded; extend this as new variants show up in CVs/free text.
_ALIASES: dict[str, str] = {
    "reactjs": "React",
    "react.js": "React",
    "vuejs": "Vue",
    "vue.js": "Vue",
    "nodejs": "Node.js",
    "node": "Node.js",
    "expressjs": "Express.js",
    "express": "Express.js",
    "nextjs": "Next.js",
    "next": "Next.js",
    "postgres": "PostgreSQL",
    "psql": "PostgreSQL",
    "js": "JavaScript",
    "ts": "TypeScript",
    "py": "Python",
    "ml": "Machine Learning",
    "ai": "Machine Learning",
    "dl": "Deep Learning",
    "nlp": "NLP",
    "cv": "Computer Vision",
    "k8s": "Kubernetes",
    "docker compose": "Docker",
    "restful api": "REST API",
    "restful apis": "REST API",
    "rest apis": "REST API",
    "graphql api": "GraphQL",
    "tailwind": "Tailwind CSS",
    "tailwindcss": "Tailwind CSS",
    "photoshop": "Adobe Photoshop",
    "illustrator": "Adobe Illustrator",
    "premiere": "Adobe Premiere Pro",
    "premiere pro": "Adobe Premiere Pro",
    "powerbi": "Power BI",
    "power-bi": "Power BI",
    "excel spreadsheets": "Excel",
    "ms excel": "Excel",
    "google analytics 4": "Google Analytics",
    "ga4": "Google Analytics",
    "seo optimization": "SEO",
    "search engine optimization": "SEO",
    "content writing skills": "Content Writing",
    "customer service skills": "Customer Service",
    "accounting skills": "Accounting",
}


@dataclass(frozen=True)
class Catalog:
    version: int
    roles: dict[str, dict]
    global_skills: list[str]
    # display-name lookups, built once at load time
    _by_key: dict[str, str]  # casefolded skill -> canonical display name

    def canonical(self, skill: str) -> str | None:
        key = re.sub(r"\s+", " ", (skill or "").strip().casefold()).rstrip(".")
        if not key:
            return None
        if key in _ALIASES:
            aliased = _ALIASES[key]
            return self._by_key.get(aliased.casefold(), aliased)
        return self._by_key.get(key)


@lru_cache
def load_catalog() -> Catalog:
    raw = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    roles = raw.get("roles", {})
    global_skills = raw.get("global_skills", [])

    by_key: dict[str, str] = {}
    for role_data in roles.values():
        for skill in role_data.get("skills", []):
            by_key[skill.casefold()] = skill
    for skill in global_skills:
        by_key[skill.casefold()] = skill

    return Catalog(
        version=raw.get("version", 1),
        roles=roles,
        global_skills=global_skills,
        _by_key=by_key,
    )


def all_skills() -> list[str]:
    """Union of every role's skills plus global skills, de-duped, sorted."""
    catalog = load_catalog()
    names = set(catalog.global_skills)
    for role_data in catalog.roles.values():
        names.update(role_data.get("skills", []))
    return sorted(names)


def skills_for_role(target_role: str | None) -> list[str]:
    """Catalog skills for a role, falling back to the closest name match, then
    global skills only if the role isn't in the catalog at all."""
    catalog = load_catalog()
    if not target_role:
        return list(catalog.global_skills)

    role = target_role.strip()
    if role in catalog.roles:
        return list(catalog.roles[role].get("skills", [])) + list(catalog.global_skills)

    # Loose match (e.g. "Senior Backend Developer" -> "Backend Developer").
    role_cf = role.casefold()
    for name, data in catalog.roles.items():
        if name.casefold() in role_cf or role_cf in name.casefold():
            return list(data.get("skills", [])) + list(catalog.global_skills)

    return list(catalog.global_skills)


def normalize_skill(skill: str) -> str | None:
    """Map free-text skill to its canonical catalog name, or None if unknown."""
    return load_catalog().canonical(skill)


def filter_to_catalog(skills: list[str]) -> list[str]:
    """Keep only skills that map to something in the catalog, normalized to
    their canonical display name, de-duped, order preserved."""
    catalog = load_catalog()
    seen: set[str] = set()
    result: list[str] = []
    for skill in skills or []:
        canonical = catalog.canonical(skill)
        if canonical and canonical.casefold() not in seen:
            seen.add(canonical.casefold())
            result.append(canonical)
    return result


def categories() -> dict[str, str]:
    """role -> category, for grouping/filtering in the frontend."""
    catalog = load_catalog()
    return {name: data.get("category", "other") for name, data in catalog.roles.items()}


def aliases() -> dict[str, str]:
    """Lowercase alias -> canonical catalog name, so the frontend can validate
    free-text skill entry client-side the same way the backend does."""
    return dict(_ALIASES)
