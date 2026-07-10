"""Build rich, normalized text for job embedding and retrieval."""

from __future__ import annotations

import re

from scraper.models import JobPosting
from scraper.normalize import skills_from_free_text

# KamKhoj keyword extraction often picks up site chrome/footer noise.
_POLLUTED_SKILL_SET = frozenset({"seo", "digital marketing", "communication", "accounting"})

_TECH_QUERY_HINTS = re.compile(
    r"\b(developer|engineer|programmer|devops|backend|frontend|full[\s-]?stack|"
    r"python|fastapi|django|react|vue|angular|machine learning|ml\b|ai\b|"
    r"data scientist|data analyst|node\.?js|javascript|typescript|php|laravel|"
    r"ios|android|swift|flutter|qa\b|tester|mis\b|software)\b",
    re.I,
)

_NON_TECH_QUERY_HINTS = re.compile(
    r"\b(bba|bca|bcd|bcom|mba|accountant|account|finance|marketing|sales|hr\b|"
    r"human resource|nurse|nursing|teacher|lecturer|hospitality|hotel|bank|"
    r"admin|receptionist|business development|graphic designer|counselor|"
    r"logistics|procurement|ngo|social mobiliz)\b",
    re.I,
)

# Aliases only when matching signals appear in title or skills.
_DOMAIN_SIGNALS: dict[str, tuple[str, ...]] = {
    # --- IT / software ---
    "backend": ("backend", "back-end", "back end", "server-side", "server side"),
    "python": ("python",),
    "fastapi": ("fastapi",),
    "django": ("django",),
    "flask": ("flask",),
    "nodejs": ("node.js", "nodejs", "node js"),
    "php": ("php",),
    "laravel": ("laravel",),
    "frontend": ("frontend", "front-end", "front end", "ui developer", "ux developer"),
    "react": ("react", "reactjs", "react.js"),
    "vue": ("vue", "vue.js", "vuejs"),
    "angular": ("angular",),
    "fullstack": ("full stack", "fullstack", "full-stack"),
    "mobile": ("mobile developer", "mobile app"),
    "ios": ("ios",),
    "swift": ("swift",),
    "android": ("android",),
    "flutter": ("flutter",),
    "devops": ("devops", "site reliability", "sre", "platform engineer"),
    "ml_ai": ("machine learning", "deep learning", "ml engineer", "ai engineer", "nlp", "generative ai"),
    "data": ("data scientist", "data analyst", "data engineer", "data science"),
    "qa": ("qa engineer", "qa automation", "quality assurance", "software tester", "test engineer", "sdet"),
    "product": ("product manager", "product owner", "product analyst"),
    "design": ("graphic designer", "ui designer", "ux designer", "product designer", "multimedia designer"),
    # --- Business / commerce (BBA, BCom, MBA, etc.) ---
    "business": ("bba", "bcom", "business administration", "business graduate", "business studies", "mba"),
    "finance": (
        "accountant", "account officer", "accounts officer", "finance officer",
        "accounts and finance", "audit", "chartered accountant", "inter ca", "tally", "sap fico",
    ),
    "banking": ("bank", "credit officer", "loan officer", "relationship manager", "teller", "microfinance"),
    "marketing": (
        "marketing officer", "marketing executive", "marketing coordinator", "brand manager",
        "brand executive", "digital marketing", "content creator", "seo executive",
    ),
    "sales": (
        "sales officer", "sales executive", "sales representative", "sales coordinator",
        "sales manager", "business development", "bdm", "client servicing",
    ),
    "hr": (
        "human resource", "hr officer", "hr executive", "hr manager", "talent acquisition",
        "recruitment", "people officer", "assistant-hr",
    ),
    # --- Healthcare ---
    "nursing": (
        "staff nurse", "health assistant", "nurse", "anm", "auxiliary nurse",
        "bn nurse", "bsc nurse", "pcl nurse", "clinical assistant", "medical officer",
    ),
    "healthcare": ("hospital", "radiograph", "laboratory technician", "anesthesia", "pharmacist", "x-ray"),
    # --- Education ---
    "education": (
        "teacher", "lecturer", "instructor", "professor", "tutor", "faculty",
        "head teacher", "eca coordinator", "kumon", "ielts", "pte instructor",
    ),
    # --- Hospitality / service ---
    "hospitality": (
        "hotel", "chef", "barista", "hospitality", "front desk", "f&b", "housekeeping",
        "tearista", "airline ticketing", "tour operation",
    ),
    # --- Admin / operations ---
    "admin": ("admin assistant", "office assistant", "administrative", "receptionist", "office helper"),
    "logistics": ("logistics", "supply chain", "warehouse", "procurement", "store keeper", "inventory"),
    # --- NGO / development sector (common in Nepal) ---
    "ngo": (
        "social mobilizer", "social mobiliser", "field officer", "program officer",
        "project coordinator", "monitoring and evaluation", "meal officer", "wash officer",
    ),
    # --- Legal / compliance ---
    "legal": ("legal officer", "compliance officer", "paralegal", "advocate"),
}

_DOMAIN_ALIASES: dict[str, list[str]] = {
    # IT
    "backend": ["backend developer", "backend engineer", "api developer"],
    "python": ["python developer", "python engineer"],
    "fastapi": ["fastapi developer"],
    "django": ["django developer"],
    "flask": ["flask developer"],
    "nodejs": ["node.js developer", "nodejs developer"],
    "php": ["php developer"],
    "laravel": ["laravel developer"],
    "frontend": ["frontend developer", "front-end developer", "ui developer"],
    "react": ["react developer"],
    "vue": ["vue developer"],
    "angular": ["angular developer"],
    "fullstack": ["full stack developer", "fullstack developer"],
    "mobile": ["mobile developer"],
    "ios": ["ios developer"],
    "swift": ["swift developer"],
    "android": ["android developer"],
    "flutter": ["flutter developer"],
    "devops": ["devops engineer", "site reliability engineer"],
    "ml_ai": ["machine learning engineer", "ml engineer", "ai engineer"],
    "data": ["data scientist", "data analyst", "data engineer"],
    "qa": ["qa engineer", "software tester"],
    "product": ["product manager", "product owner"],
    "design": ["graphic designer", "ui designer", "ux designer"],
    # Business / commerce
    "business": ["business administration graduate", "bba graduate", "management trainee"],
    "finance": ["accountant", "finance officer", "accounts executive"],
    "banking": ["bank officer", "credit officer", "relationship manager"],
    "marketing": ["marketing executive", "marketing officer", "brand executive"],
    "sales": ["sales executive", "sales officer", "business development executive"],
    "hr": ["human resource officer", "hr executive", "talent acquisition specialist"],
    # Healthcare
    "nursing": ["staff nurse", "health assistant", "registered nurse"],
    "healthcare": ["healthcare assistant", "medical technician"],
    # Education
    "education": ["teacher", "lecturer", "academic instructor"],
    # Hospitality
    "hospitality": ["hotel staff", "front desk officer", "food and beverage staff"],
    # Admin / ops
    "admin": ["administrative assistant", "office assistant"],
    "logistics": ["logistics officer", "supply chain coordinator"],
    # NGO
    "ngo": ["project coordinator", "field officer", "social mobilizer"],
    # Legal
    "legal": ["legal officer", "compliance officer"],
}

# When multiple IT stacks collide, keep the best-evidenced group only.
_EXCLUSIVE_GROUPS = (
    frozenset({"frontend", "react", "vue", "angular", "design"}),
    frozenset({"backend", "python", "fastapi", "django", "flask", "nodejs", "php", "laravel"}),
    frozenset({"ios", "swift", "android", "flutter", "mobile"}),
    frozenset({"data", "ml_ai"}),
    frozenset({"qa"}),
    frozenset({"product"}),
    frozenset({"devops"}),
    # Non-tech: nursing vs hospitality vs education rarely overlap in one title.
    frozenset({"nursing", "healthcare"}),
    frozenset({"education"}),
    frozenset({"hospitality"}),
    frozenset({"finance", "banking"}),
)


def _contains_term(text: str, term: str) -> bool:
    if len(term) <= 3:
        pattern = r"(?<![a-z0-9+#.])" + re.escape(term) + r"(?![a-z0-9])"
        return bool(re.search(pattern, text.casefold()))
    return term.casefold() in text.casefold()


_STOPWORDS = frozenset({
    "a", "an", "the", "and", "or", "for", "in", "at", "to", "of", "with", "on",
    "job", "jobs", "role", "position", "nepal", "kathmandu", "graduate", "fresh",
})


def _tokenize(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9+#.]+", text.casefold())
        if len(token) > 1 and token not in _STOPWORDS
    ]


def effective_skills(job: JobPosting) -> list[str]:
    """Use title-derived skills when scraped skills look like polluted defaults."""
    skills = [s.strip() for s in job.required_skills if s.strip()]
    if not skills:
        return skills_from_free_text(job.title)[:12]

    normalized = {s.casefold() for s in skills}
    polluted_hits = len(normalized & _POLLUTED_SKILL_SET)
    if polluted_hits >= 2 and polluted_hits >= len(normalized) // 2:
        from_title = skills_from_free_text(job.title)
        from_skills = [s for s in skills if s.casefold() not in _POLLUTED_SKILL_SET]
        merged = from_title + from_skills
        return merged[:12] if merged else from_title[:12]
    return skills[:20]


def _detect_domains(title: str, skills: list[str]) -> set[str]:
    """Return role domains supported by explicit title/skill evidence only."""
    blob = f"{title} {' '.join(skills)}"
    domains: set[str] = set()
    for domain, signals in _DOMAIN_SIGNALS.items():
        if any(_contains_term(blob, signal) for signal in signals):
            domains.add(domain)

    if "backend" not in domains and re.search(
        r"\b(api developer|backend developer|back[\s-]?end developer|server[\s-]?side)\b",
        blob,
        re.I,
    ):
        domains.add("backend")

    # BCA / BCD often appear in education lines — map to business/tech only when explicit.
    title_lower = title.casefold()
    if _contains_term(title_lower, "bca") or _contains_term(title_lower, "computer application"):
        domains.add("backend")
    if _contains_term(title_lower, "bcd"):
        domains.add("business")

    if "fullstack" in domains:
        return domains

    active_groups = [group for group in _EXCLUSIVE_GROUPS if domains & group]
    if len(active_groups) > 1:

        def title_hits(group: frozenset[str]) -> int:
            return sum(
                1
                for domain in group
                for signal in _DOMAIN_SIGNALS.get(domain, ())
                if _contains_term(title_lower, signal)
            )

        best = max(active_groups, key=title_hits)
        domains = (domains - set().union(*active_groups)) | (domains & best)

    return domains


def derive_role_aliases(title: str, skills: list[str]) -> list[str]:
    """Build aliases strictly from title + skills — never inject unrelated role families."""
    clean_title = re.sub(r"\s+", " ", title.strip())
    aliases: list[str] = [clean_title] if clean_title else []
    domains = _detect_domains(clean_title, skills)

    for domain in sorted(domains):
        for alias in _DOMAIN_ALIASES.get(domain, []):
            if alias.casefold() != clean_title.casefold():
                aliases.append(alias)

    return list(dict.fromkeys(aliases))


def infer_role_category(title: str, skills: list[str]) -> str:
    domains = _detect_domains(title, skills)
    priority = (
        # IT
        "frontend", "backend", "fullstack", "mobile", "ios", "android", "devops",
        "ml_ai", "data", "qa", "product", "design", "php", "python",
        # Non-tech
        "nursing", "healthcare", "education", "hospitality", "finance", "banking",
        "marketing", "sales", "hr", "business", "admin", "logistics", "ngo", "legal",
    )
    for domain in priority:
        if domain in domains:
            if domain in {"ios", "android", "flutter"}:
                return "mobile"
            if domain in {"php", "python", "nodejs", "fastapi", "django", "flask"}:
                return "backend"
            return domain
    if re.search(r"\b(developer|engineer|programmer|software)\b", title, re.I):
        return "software"
    if re.search(r"\b(mis|support technician|technical business analyst)\b", title, re.I):
        return "tech"
    return "general"


def is_technical_query(query: str) -> bool:
    return bool(_TECH_QUERY_HINTS.search(query))


def is_non_technical_query(query: str) -> bool:
    return bool(_NON_TECH_QUERY_HINTS.search(query))


def job_to_document(job: JobPosting) -> str:
    """Rich embedding text — aliases only when title/skills justify them."""
    skills = effective_skills(job)
    skills_text = ", ".join(skills) if skills else "not specified"
    aliases = derive_role_aliases(job.title, skills)
    category = infer_role_category(job.title, skills)
    is_tech = category in {
        "frontend", "backend", "fullstack", "mobile", "devops", "ml_ai", "data",
        "qa", "product", "design", "software", "tech",
    }

    sections = [
        f"Job Title: {job.title}",
        f"Role: {job.title}",
        f"Category: {category}",
        f"Company: {job.company}",
        f"Location: {job.location}",
        f"Required Skills: {skills_text}",
    ]
    if is_tech:
        sections.append(f"Technologies: {skills_text}")
    else:
        sections.append(f"Qualifications: {skills_text}")
    sections.append(f"Salary: {job.salary_range}")

    extra_aliases = [alias for alias in aliases if alias.casefold() != job.title.casefold()]
    if extra_aliases:
        sections.insert(2, f"Related Roles: {' | '.join(extra_aliases[:8])}")
    if job.original_source:
        sections.append(f"Source Portal: {job.original_source}")
    return "\n".join(sections)


def job_to_metadata(job: JobPosting) -> dict:
    skills = effective_skills(job)
    return {
        "source": job.source,
        "title": job.title,
        "title_lower": job.title.casefold(),
        "company": job.company,
        "location": job.location,
        "required_skills": ", ".join(skills),
        "salary_range": job.salary_range,
        "source_url": job.source_url,
        "role_category": infer_role_category(job.title, skills),
        "aggregator": job.aggregator or "",
        "original_source": job.original_source or "",
    }


def normalize_search_query(query: str) -> str:
    """Expand query only with aliases justified by the query text itself."""
    cleaned = re.sub(r"\s+", " ", query.strip())
    if not cleaned:
        return cleaned

    query_skills = skills_from_free_text(cleaned)
    aliases = derive_role_aliases(cleaned, query_skills)
    extras = [alias for alias in aliases if alias.casefold() != cleaned.casefold()]
    if extras:
        return f"{cleaned} | {' | '.join(extras[:8])}"
    return cleaned


def title_overlap_score(query: str, title: str) -> float:
    query_tokens = set(_tokenize(query))
    title_tokens = set(_tokenize(title))
    if not query_tokens:
        return 0.0
    return len(query_tokens & title_tokens) / len(query_tokens)


def skill_overlap_score(query: str, skills: list[str]) -> float:
    query_tokens = set(_tokenize(query))
    if not query_tokens or not skills:
        return 0.0
    skill_tokens = set(_tokenize(" ".join(skills)))
    if not skill_tokens:
        return 0.0
    return len(query_tokens & skill_tokens) / len(query_tokens)


def role_category_match(query: str, category: str) -> float:
    lowered = query.casefold()
    mapping = {
        # IT
        "backend": ("backend", "fastapi", "django", "api developer", "python developer", "php developer"),
        "frontend": ("frontend", "react", "vue", "angular", "ui developer"),
        "fullstack": ("full stack", "fullstack", "full-stack"),
        "mobile": ("ios", "android", "flutter", "mobile developer", "swift"),
        "ml_ai": ("machine learning", "ml engineer", "ai engineer", "deep learning", "nlp"),
        "data": ("data scientist", "data analyst", "data engineer"),
        "devops": ("devops", "sre", "kubernetes", "docker"),
        "qa": ("qa", "quality assurance", "tester"),
        "product": ("product manager", "product owner"),
        "design": ("designer", "ui", "ux", "graphic"),
        "software": ("software engineer", "software developer", "programmer"),
        "tech": ("mis", "technical", "support technician"),
        # Non-tech
        "business": ("bba", "bcom", "mba", "business administration", "business graduate", "bcd"),
        "finance": ("accountant", "account", "finance", "audit", "tally"),
        "banking": ("bank", "credit officer", "loan", "relationship manager"),
        "marketing": ("marketing", "brand", "digital marketing", "content"),
        "sales": ("sales", "business development", "bdm", "client servicing"),
        "hr": ("human resource", "hr ", "talent acquisition", "recruitment"),
        "nursing": ("nurse", "nursing", "health assistant", "anm"),
        "healthcare": ("hospital", "clinical", "medical", "radiograph"),
        "education": ("teacher", "lecturer", "instructor", "professor", "tutor", "faculty"),
        "hospitality": ("hotel", "chef", "barista", "hospitality", "front desk", "f&b"),
        "admin": ("admin", "office assistant", "receptionist"),
        "logistics": ("logistics", "supply chain", "procurement", "warehouse"),
        "ngo": ("social mobiliz", "field officer", "project coordinator", "ngo"),
        "legal": ("legal", "compliance", "paralegal"),
    }
    if category not in mapping:
        return 0.0
    return 1.0 if any(_contains_term(lowered, term) for term in mapping[category]) else 0.0
