from __future__ import annotations

import re
from html import unescape

from bs4 import BeautifulSoup

WHITESPACE_RE = re.compile(r"\s+")
SALARY_NEGOTIABLE_RE = re.compile(r"\b(negotiable|not disclosed|as per company policy)\b", re.I)
SALARY_RANGE_RE = re.compile(
    r"\b(?:nrs\.?|rs\.?|npr)\s*(\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?)",
    re.I,
)
TECH_KEYWORDS = [
    "python",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "nodejs",
    "vue.js",
    "vue",
    "laravel",
    "php",
    "java",
    "spring",
    "django",
    "flask",
    "fastapi",
    "sql",
    "mysql",
    "postgresql",
    "mongodb",
    "aws",
    "azure",
    "docker",
    "kubernetes",
    "git",
    "html",
    "css",
    "tailwind",
    "bootstrap",
    "rest api",
    "graphql",
    "excel",
    "power bi",
    "tableau",
    "salesforce",
    "figma",
    "photoshop",
    "illustrator",
    "seo",
    "digital marketing",
    "content writing",
    "communication",
    "negotiation",
    "accounting",
    "tally",
    "sap",
    "devops",
    "qa",
    "selenium",
    "c++",
    "c#",
    ".net",
    "android",
    "ios",
    "flutter",
    "react native",
    "machine learning",
    "data analysis",
    "project management",
    "agile",
    "scrum",
]


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return WHITESPACE_RE.sub(" ", unescape(value)).strip()


def dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = clean_text(item)
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def format_merojob_salary(salary: dict | None, hidden: bool = False) -> str:
    if not salary:
        return "Negotiable" if not hidden else "Not disclosed"
    minimum = salary.get("minimum")
    maximum = salary.get("maximum")
    currency = salary.get("currency") or "NRs"
    unit = salary.get("unit") or "Monthly"
    if minimum not in (None, 0) or maximum:
        if maximum:
            low = int(minimum or 0)
            return f"{currency} {low:,} - {int(maximum):,} {unit}"
        return f"{currency} {int(minimum):,}+ {unit}"
    if hidden:
        return "Not disclosed"
    return "Negotiable"


def extract_salary_from_text(text: str) -> str:
    cleaned = clean_text(text)
    if not cleaned:
        return "Not disclosed"
    if SALARY_NEGOTIABLE_RE.search(cleaned):
        return "Negotiable"
    match = SALARY_RANGE_RE.search(cleaned)
    if match:
        return f"NRs {match.group(1)}"
    if re.search(r"competitive salary", cleaned, re.I):
        return "Competitive"
    return "Not disclosed"


def html_to_text(html: str | None) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    return clean_text(soup.get_text(" ", strip=True))


def skills_from_html_lists(html: str | None, *, max_items: int = 8) -> list[str]:
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    items: list[str] = []
    requirement_prefixes = (
        "bachelor",
        "master",
        "years of",
        "year of",
        "fresh graduate",
        "must possess",
        "preferred",
        "minimum",
        "maximum",
        "able to",
        "willing to",
    )
    for li in soup.select("li"):
        text = clean_text(li.get_text(" ", strip=True))
        if not (2 <= len(text) <= 60):
            continue
        lowered = text.casefold()
        if any(lowered.startswith(prefix) for prefix in requirement_prefixes):
            continue
        if any(token in lowered for token in ("degree", "experience in", "license")):
            continue
        items.append(text)
    return dedupe_preserve_order(items)[:max_items]


def skills_from_free_text(text: str) -> list[str]:
    lowered = text.casefold()
    found: list[str] = []
    for keyword in TECH_KEYWORDS:
        # Word-boundary match so "excellent" doesn't yield Excel, "laws" -> AWS.
        pattern = r"(?<![a-z0-9+#.])" + re.escape(keyword) + r"(?![a-z0-9])"
        if re.search(pattern, lowered):
            found.append(keyword.title() if keyword.islower() else keyword)
    return dedupe_preserve_order(found)


def merge_skills(*skill_lists: list[str], description: str = "") -> list[str]:
    merged = dedupe_preserve_order([skill for group in skill_lists for skill in group])
    if merged:
        return merged[:20]
    return skills_from_free_text(description)[:12]
