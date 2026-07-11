"""Real learning-resource layer for the roadmap and learning curriculum.

Turns a target skill into concrete, real, in-app-consumable resources — never
a link that redirects the student out of DISHA, since leaving the app means
losing dwell-time progress tracking. Every resource returned here has
``consume`` set to either ``"embed"`` (a real YouTube video, playable inline)
or ``"markdown"`` (Context7 docs, rendered inline) — nothing else is ever
attached to a task/node/module.

Priority order, per skill:
    1. Curated catalog YouTube videos (embed) — no network call, always available.
    2. If ``MCP_ENABLED``: Context7 docs for the skill (markdown).
    3. If ``MCP_ENABLED`` and no video yet: DuckDuckGo-searched YouTube videos (embed).

If none of these produce anything (MCP disabled and the skill isn't in the
curated catalog), the skill simply gets no resources — the UI shows "no
resource yet" rather than a dead-end external link.
"""

from __future__ import annotations

import asyncio
import re

from app.config import get_settings
from app.services.mcp_client import fetch_library_docs, search_learning_web
from app.services.skill_gap import normalize_skill_name

# A resource dict shape:
#   {title, url, provider, type, cost, duration, embed_url, consume, content_md}
#   type ∈ {"video","article","docs","course","practice"}
#   cost ∈ {"free","paid"}
#   consume ∈ {"embed","markdown",None} — what the in-app Learning viewer can
#       open directly; None means it's a deep-link the Learning panel won't
#       attach (only the roadmap queue, which still opens links in a new tab).

_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})"
)


def youtube_video_id(url: str | None) -> str | None:
    if not url:
        return None
    match = _YOUTUBE_ID_RE.search(url)
    return match.group(1) if match else None


def youtube_embed_url(video_id: str) -> str:
    return f"https://www.youtube.com/embed/{video_id}"


def is_youtube_url(url: str | None) -> bool:
    return youtube_video_id(url) is not None


def normalize_resource(resource: dict) -> dict:
    """Fill in embed_url/consume/content_md for a resource dict that doesn't
    already declare them. Never overwrites an explicit ``consume`` (e.g.
    Context7 docs resources from ``mcp_client`` already set it)."""
    resource.setdefault("embed_url", None)
    resource.setdefault("content_md", None)
    if resource.get("consume"):
        return resource

    video_id = youtube_video_id(resource.get("url")) if resource.get("type") == "video" else None
    if video_id:
        resource["embed_url"] = youtube_embed_url(video_id)
        resource["consume"] = "embed"
    else:
        resource["consume"] = None
    return resource

_CATALOG: dict[str, list[dict]] = {
    "python": [
        {"title": "Python for Beginners — Full Course", "url": "https://www.youtube.com/watch?v=rfscVS0vtbw", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "4h 26m"},
        {"title": "The Python Tutorial (Official Docs)", "url": "https://docs.python.org/3/tutorial/", "provider": "python.org", "type": "docs", "cost": "free", "duration": None},
    ],
    "fastapi": [
        {"title": "FastAPI Tutorial (Official)", "url": "https://fastapi.tiangolo.com/tutorial/", "provider": "fastapi.tiangolo.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "FastAPI Course — Build & Deploy APIs", "url": "https://www.youtube.com/watch?v=0sOvCWFmrtA", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "4h 12m"},
    ],
    "django": [
        {"title": "Django Getting Started (Official)", "url": "https://docs.djangoproject.com/en/stable/intro/tutorial01/", "provider": "djangoproject.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "Django Full Course", "url": "https://www.youtube.com/watch?v=rHux0gMZ3Eg", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 44m"},
    ],
    "flask": [
        {"title": "Flask Documentation", "url": "https://flask.palletsprojects.com/en/stable/quickstart/", "provider": "palletsprojects.com", "type": "docs", "cost": "free", "duration": None},
    ],
    "javascript": [
        {"title": "The Modern JavaScript Tutorial", "url": "https://javascript.info/", "provider": "javascript.info", "type": "docs", "cost": "free", "duration": None},
        {"title": "JavaScript Programming — Full Course", "url": "https://www.youtube.com/watch?v=PkZNo7MFNFg", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 26m"},
    ],
    "typescript": [
        {"title": "TypeScript Handbook (Official)", "url": "https://www.typescriptlang.org/docs/handbook/intro.html", "provider": "typescriptlang.org", "type": "docs", "cost": "free", "duration": None},
        {"title": "TypeScript Course for Beginners", "url": "https://www.youtube.com/watch?v=30LWjhZzg50", "provider": "Academind", "type": "video", "cost": "free", "duration": "1h 34m"},
    ],
    "react": [
        {"title": "Learn React (Official)", "url": "https://react.dev/learn", "provider": "react.dev", "type": "docs", "cost": "free", "duration": None},
        {"title": "React Course — Beginner's Tutorial", "url": "https://www.youtube.com/watch?v=bMknfKXIFA8", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "11h 55m"},
    ],
    "next.js": [
        {"title": "Next.js Learn (Official Course)", "url": "https://nextjs.org/learn", "provider": "nextjs.org", "type": "course", "cost": "free", "duration": None},
    ],
    "node.js": [
        {"title": "Learn Node.js (Official)", "url": "https://nodejs.org/en/learn", "provider": "nodejs.org", "type": "docs", "cost": "free", "duration": None},
        {"title": "Node.js and Express Full Course", "url": "https://www.youtube.com/watch?v=Oe421EPjeBE", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "8h 16m"},
    ],
    "postgresql": [
        {"title": "PostgreSQL Tutorial", "url": "https://www.postgresqltutorial.com/", "provider": "postgresqltutorial.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "PostgreSQL Full Course", "url": "https://www.youtube.com/watch?v=qw--VYLpxG4", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "4h 20m"},
    ],
    "sql": [
        {"title": "SQLBolt — Interactive SQL Lessons", "url": "https://sqlbolt.com/", "provider": "sqlbolt.com", "type": "practice", "cost": "free", "duration": None},
        {"title": "SQL Full Course for Beginners", "url": "https://www.youtube.com/watch?v=HXV3zeQKqGY", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "4h 20m"},
    ],
    "mongodb": [
        {"title": "MongoDB Manual — Get Started", "url": "https://www.mongodb.com/docs/manual/tutorial/getting-started/", "provider": "mongodb.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "MongoDB University (Free Courses)", "url": "https://learn.mongodb.com/", "provider": "MongoDB University", "type": "course", "cost": "free", "duration": None},
    ],
    "docker": [
        {"title": "Docker for Beginners", "url": "https://docker-curriculum.com/", "provider": "docker-curriculum.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "Docker Tutorial for Beginners", "url": "https://www.youtube.com/watch?v=fqMOX6JJhGo", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "2h 10m"},
    ],
    "kubernetes": [
        {"title": "Kubernetes Tutorials (Official)", "url": "https://kubernetes.io/docs/tutorials/", "provider": "kubernetes.io", "type": "docs", "cost": "free", "duration": None},
        {"title": "Kubernetes Course — Full Beginners", "url": "https://www.youtube.com/watch?v=X48VuDVv0do", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 36m"},
    ],
    "aws": [
        {"title": "AWS Getting Started", "url": "https://aws.amazon.com/getting-started/", "provider": "aws.amazon.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "AWS Certified Cloud Practitioner", "url": "https://www.youtube.com/watch?v=SOTamWNgDKc", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "4h 0m"},
    ],
    "git": [
        {"title": "Git and GitHub for Beginners", "url": "https://www.youtube.com/watch?v=RGOj5yH7evk", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "1h 8m"},
        {"title": "GitHub — Get Started (Docs)", "url": "https://docs.github.com/en/get-started", "provider": "docs.github.com", "type": "docs", "cost": "free", "duration": None},
    ],
    "rest api": [
        {"title": "APIs for Beginners", "url": "https://www.youtube.com/watch?v=WXsD0ZgxjRw", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "2h 19m"},
    ],
    "html": [
        {"title": "HTML Full Course", "url": "https://www.youtube.com/watch?v=mU6anWqZJcc", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "2h 0m"},
        {"title": "MDN — HTML Basics", "url": "https://developer.mozilla.org/en-US/docs/Learn/HTML", "provider": "MDN", "type": "docs", "cost": "free", "duration": None},
    ],
    "css": [
        {"title": "CSS Full Course", "url": "https://www.youtube.com/watch?v=OXGznpKZ_sA", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "6h 18m"},
        {"title": "MDN — Learn CSS", "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS", "provider": "MDN", "type": "docs", "cost": "free", "duration": None},
    ],
    "java": [
        {"title": "Java Programming Full Course", "url": "https://www.youtube.com/watch?v=grEKMHGYyns", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "2h 30m"},
    ],
    "c++": [
        {"title": "Learn C++", "url": "https://www.learncpp.com/", "provider": "learncpp.com", "type": "docs", "cost": "free", "duration": None},
    ],
    "machine learning": [
        {"title": "Machine Learning for Everybody", "url": "https://www.youtube.com/watch?v=i_LwzRVP7bg", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 53m"},
        {"title": "Machine Learning Specialization", "url": "https://www.coursera.org/specializations/machine-learning-introduction", "provider": "Coursera (Andrew Ng)", "type": "course", "cost": "paid", "duration": None},
    ],
    "artificial intelligence": [
        {"title": "Machine Learning for Everybody", "url": "https://www.youtube.com/watch?v=i_LwzRVP7bg", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 53m"},
    ],
    "tensorflow": [
        {"title": "TensorFlow Tutorials (Official)", "url": "https://www.tensorflow.org/tutorials", "provider": "tensorflow.org", "type": "docs", "cost": "free", "duration": None},
    ],
    "pandas": [
        {"title": "Pandas — Getting Started (Official)", "url": "https://pandas.pydata.org/docs/getting_started/index.html", "provider": "pandas.pydata.org", "type": "docs", "cost": "free", "duration": None},
        {"title": "Data Analysis with Python", "url": "https://www.youtube.com/watch?v=r-uOLxNrNk8", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "10h 0m"},
    ],
    "excel": [
        {"title": "Microsoft Excel Tutorial for Beginners", "url": "https://www.youtube.com/watch?v=Vl0H-qTclOg", "provider": "Kevin Stratvert", "type": "video", "cost": "free", "duration": "2h 0m"},
    ],
    "digital marketing": [
        {"title": "Fundamentals of Digital Marketing", "url": "https://learndigital.withgoogle.com/digitalgarage/course/digital-marketing", "provider": "Google Digital Garage", "type": "course", "cost": "free", "duration": None},
    ],
    "linux": [
        {"title": "Linux Journey", "url": "https://linuxjourney.com/", "provider": "linuxjourney.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "Linux for Beginners — Full Course", "url": "https://www.youtube.com/watch?v=sWbUDq4S6Y8", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "5h 0m"},
    ],
    "bash": [
        {"title": "Bash Scripting Tutorial", "url": "https://www.freecodecamp.org/news/shell-scripting-crash-course-how-to-write-bash-scripts-in-linux/", "provider": "freeCodeCamp", "type": "article", "cost": "free", "duration": None},
        {"title": "Bash Scripting Full Course", "url": "https://www.youtube.com/watch?v=tK9Oc6AEnR4", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "1h 0m"},
    ],
    "ci/cd": [
        {"title": "What is CI/CD? (GitLab Docs)", "url": "https://docs.gitlab.com/ee/ci/", "provider": "GitLab", "type": "docs", "cost": "free", "duration": None},
        {"title": "CI/CD Pipeline Tutorial", "url": "https://www.youtube.com/watch?v=R8_veQiY664", "provider": "TechWorld with Nana", "type": "video", "cost": "free", "duration": "1h 0m"},
    ],
    "jenkins": [
        {"title": "Jenkins User Documentation", "url": "https://www.jenkins.io/doc/", "provider": "jenkins.io", "type": "docs", "cost": "free", "duration": None},
        {"title": "Jenkins Tutorial for Beginners", "url": "https://www.youtube.com/watch?v=6YZvp2GxZ0E", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "1h 30m"},
    ],
    "terraform": [
        {"title": "Terraform Tutorials (HashiCorp)", "url": "https://developer.hashicorp.com/terraform/tutorials", "provider": "HashiCorp", "type": "docs", "cost": "free", "duration": None},
        {"title": "Terraform Course — Beginner to Advanced", "url": "https://www.youtube.com/watch?v=7xngnjfIlK4", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 0m"},
    ],
    "ansible": [
        {"title": "Ansible Getting Started", "url": "https://docs.ansible.com/ansible/latest/getting_started/index.html", "provider": "ansible.com", "type": "docs", "cost": "free", "duration": None},
        {"title": "Ansible for Beginners", "url": "https://www.youtube.com/watch?v=5hycyr-8EKs", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 0m"},
    ],
    "nginx": [
        {"title": "NGINX Beginner's Guide", "url": "https://nginx.org/en/docs/beginners_guide.html", "provider": "nginx.org", "type": "docs", "cost": "free", "duration": None},
    ],
    "prometheus": [
        {"title": "Prometheus Getting Started", "url": "https://prometheus.io/docs/prometheus/latest/getting_started/", "provider": "prometheus.io", "type": "docs", "cost": "free", "duration": None},
    ],
    "grafana": [
        {"title": "Grafana Fundamentals", "url": "https://grafana.com/tutorials/grafana-fundamentals/", "provider": "grafana.com", "type": "docs", "cost": "free", "duration": None},
    ],
    "communication": [
        {"title": "Technical Writing One (Google)", "url": "https://developers.google.com/tech-writing/one", "provider": "Google Developers", "type": "course", "cost": "free", "duration": None},
        {"title": "How to Communicate Effectively at Work", "url": "https://www.youtube.com/watch?v=HAnw168huqA", "provider": "Harvard Business Review", "type": "video", "cost": "free", "duration": "10m"},
    ],
    "devops": [
        {"title": "DevOps Roadmap Overview", "url": "https://roadmap.sh/devops", "provider": "roadmap.sh", "type": "docs", "cost": "free", "duration": None},
        {"title": "DevOps Engineering Course", "url": "https://www.youtube.com/watch?v=j5Zsaek5JZI", "provider": "freeCodeCamp", "type": "video", "cost": "free", "duration": "3h 0m"},
    ],
}


def _budget_allows_paid(budget: str | None) -> bool:
    if not budget:
        return False
    return "free" not in budget.strip().casefold()


async def async_build_resources_for_skill(skill: str, *, budget: str | None = "free", limit: int = 3) -> list[dict]:
    """The one resource builder for every student-facing surface (roadmap
    tasks/nodes, learning-curriculum modules). Only returns resources the
    in-app viewer can open directly (YouTube embed or Context7 markdown) —
    never a search-page or docs-site deep-link, since nothing here may ever
    send the student out of the app (see module docstring)."""
    allow_paid = _budget_allows_paid(budget)
    key = normalize_skill_name(skill)

    resources: list[dict] = []
    for entry in _CATALOG.get(key, []):
        if entry["cost"] == "paid" and not allow_paid:
            continue
        normalized = normalize_resource(dict(entry))
        if normalized["consume"] == "embed":
            resources.append(normalized)

    settings = get_settings()
    if settings.mcp_enabled:
        docs = await fetch_library_docs(skill)
        if docs:
            resources.append(normalize_resource(docs))

        if not any(r["type"] == "video" for r in resources):
            found = await search_learning_web(f"{skill} tutorial site:youtube.com")
            for item in found:
                url = item.get("url") or ""
                if not is_youtube_url(url):
                    continue
                resources.append(
                    normalize_resource(
                        {
                            "title": item.get("title") or f"{skill} tutorial",
                            "url": url,
                            "provider": "YouTube",
                            "type": "video",
                            "cost": "free",
                            "duration": None,
                        }
                    )
                )

    seen: set[str] = set()
    unique: list[dict] = []
    for r in resources:
        if r["consume"] not in ("embed", "markdown"):
            continue
        if r["url"] in seen:
            continue
        seen.add(r["url"])
        unique.append(r)
        if len(unique) >= limit:
            break

    return unique


def _needs_regeneration(resources: list[dict] | None) -> bool:
    """True if ``resources`` is empty, or (legacy data predating the
    in-app-only contract) contains even one entry the Learning viewer can't
    open in-app — e.g. an old search-page/docs-site deep-link with
    ``consume: None`` sitting alongside a still-good catalog video. Every
    persisted resource list must be fully consumable, never a mix, since the
    UI may pick any entry to show first."""
    if not resources:
        return True
    return not all(r.get("consume") in ("embed", "markdown") for r in resources)


async def attach_resources_to_weeks(weeks: list[dict], *, budget: str | None = "free") -> bool:
    """Backfill ``resources`` onto each task in an already-serialized plan.

    Returns True if anything changed (so callers can decide to persist).
    Idempotent once every task has at least one in-app-consumable resource.
    Looked up concurrently so backfilling an entire plan costs one round
    trip's worth of latency, not one per task.
    """
    pending = [
        task
        for week in weeks or []
        for task in week.get("tasks", []) or []
        if _needs_regeneration(task.get("resources")) and (task.get("skill") or week.get("theme"))
    ]
    if not pending:
        return False
    skills = [task.get("skill") or "" for task in pending]
    results = await asyncio.gather(*(async_build_resources_for_skill(skill, budget=budget) for skill in skills))
    for task, resources in zip(pending, results):
        task["resources"] = resources
    return True


async def attach_resources_to_path(path: dict | None, *, budget: str | None = "free") -> bool:
    """Backfill ``resources`` onto each node of an already-serialized skill path.

    Mirrors ``attach_resources_to_weeks`` for the roadmap.sh-style path format —
    roadmaps generated before a node's resources existed (or where generation
    silently produced none) would otherwise have a permanently dead "Open"
    button, since the skill-path format has no other backfill path.
    """
    if not path:
        return False
    pending = [
        node
        for phase in path.get("phases", []) or []
        for node in phase.get("nodes", []) or []
        if _needs_regeneration(node.get("resources")) and (node.get("skill") or node.get("title"))
    ]
    if not pending:
        return False
    skills = [node.get("skill") or node.get("title") or "" for node in pending]
    results = await asyncio.gather(*(async_build_resources_for_skill(skill, budget=budget) for skill in skills))
    for node, resources in zip(pending, results):
        node["resources"] = resources
    return True
