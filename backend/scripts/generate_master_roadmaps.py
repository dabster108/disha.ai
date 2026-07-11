"""Standalone generator for backend/app/data/roadmaps/*.json — no app imports."""

from __future__ import annotations

import json
import re
from pathlib import Path

FOUNDATIONAL_LADDERS: dict[str, list[tuple[str, list[str]]]] = {
    "frontend": [
        ("Foundations", ["HTML", "CSS", "JavaScript", "Git"]),
        ("Core Frontend", ["Responsive Design", "TypeScript", "React"]),
        ("Advanced Frontend", ["State Management", "Next.js", "Testing"]),
        ("Job Ready", ["REST API Integration", "Performance Optimization", "Deployment"]),
    ],
    "backend": [
        ("Foundations", ["Programming Fundamentals", "Git", "SQL"]),
        ("Core Backend", ["Python", "REST API", "Databases"]),
        ("Advanced Backend", ["Authentication", "Docker", "Caching"]),
        ("Job Ready", ["System Design Basics", "Testing", "Deployment"]),
    ],
    "fullstack": [
        ("Foundations", ["HTML", "CSS", "JavaScript", "Git"]),
        ("Frontend", ["React", "TypeScript"]),
        ("Backend", ["Node.js", "REST API", "SQL"]),
        ("Job Ready", ["Authentication", "Deployment", "Testing"]),
    ],
    "mobile": [
        ("Foundations", ["Programming Fundamentals", "Git", "UI Design Basics"]),
        ("Core Mobile", ["Flutter", "Mobile UI Patterns", "REST API Integration"]),
        ("Advanced Mobile", ["State Management", "Local Storage", "Push Notifications"]),
        ("Job Ready", ["App Store Deployment", "Testing", "Performance Optimization"]),
    ],
    "devops": [
        ("Foundations", ["Linux Basics", "Git", "Networking Basics"]),
        ("Core DevOps", ["Docker", "CI/CD", "AWS"]),
        ("Advanced DevOps", ["Kubernetes", "Infrastructure as Code", "Monitoring"]),
        ("Job Ready", ["Security Basics", "Incident Response", "Cost Optimization"]),
    ],
    "ml_ai": [
        ("Foundations", ["Python", "Statistics Basics", "Linear Algebra Basics"]),
        ("Core ML", ["Pandas", "Machine Learning", "Model Evaluation"]),
        ("Advanced ML", ["TensorFlow", "Deep Learning", "Feature Engineering"]),
        ("Job Ready", ["MLOps Basics", "Model Deployment", "Data Pipelines"]),
    ],
    "data": [
        ("Foundations", ["Excel", "SQL", "Statistics Basics"]),
        ("Core Data", ["Python", "Pandas", "Data Visualization"]),
        ("Advanced Data", ["ETL Pipelines", "Data Warehousing", "A/B Testing"]),
        ("Job Ready", ["Dashboarding", "Storytelling with Data", "Stakeholder Communication"]),
    ],
    "qa": [
        ("Foundations", ["Software Testing Basics", "Git", "SQL"]),
        ("Core QA", ["Test Case Design", "Manual Testing", "Bug Tracking"]),
        ("Advanced QA", ["Automation Testing", "API Testing", "CI/CD for Tests"]),
        ("Job Ready", ["Performance Testing", "Test Strategy", "Reporting"]),
    ],
    "design": [
        ("Foundations", ["Design Principles", "Typography", "Color Theory"]),
        ("Core Design", ["Figma", "Wireframing", "Prototyping"]),
        ("Advanced Design", ["Design Systems", "User Research", "Interaction Design"]),
        ("Job Ready", ["Portfolio Building", "Handoff to Developers", "Usability Testing"]),
    ],
}

_ROLE_REGISTRY: dict[str, tuple[str, str]] = {
    "frontend-developer": ("Frontend Developer", "frontend"),
    "backend-developer": ("Backend Developer", "backend"),
    "fullstack-developer": ("Full Stack Developer", "fullstack"),
    "mobile-developer": ("Mobile App Developer", "mobile"),
    "devops-engineer": ("DevOps Engineer", "devops"),
    "ai-ml-engineer": ("AI / ML Engineer", "ml_ai"),
    "data-scientist": ("Data Scientist", "data"),
    "qa-engineer": ("QA / Test Engineer", "qa"),
    "ui-ux-designer": ("UI/UX Designer", "design"),
    "cloud-engineer": ("Cloud Engineer", "devops"),
    "cybersecurity-analyst": ("Cybersecurity Analyst", "qa"),
}

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    return _SLUG_RE.sub("-", text.strip().casefold()).strip("-") or "node"


def unique_id(base: str, seen: set[str]) -> str:
    candidate = base
    i = 2
    while candidate in seen:
        candidate = f"{base}-{i}"
        i += 1
    seen.add(candidate)
    return candidate


def build_doc(role_key: str, display: str, ladder: list[tuple[str, list[str]]]) -> dict:
    prev_id: str | None = None
    order = 1
    phases = []
    seen_phase_ids: set[str] = set()

    for phase_title, skills in ladder:
        nodes = []
        for skill in skills:
            nid = slugify(skill)
            nodes.append(
                {
                    "id": nid,
                    "skill": skill,
                    "title": skill,
                    "description": f"Learn {skill} for {display}.",
                    "order": order,
                    "dependencies": [prev_id] if prev_id else [],
                    "estimated_hours": 6.0,
                    "suggested_projects": [f"Apply {skill} in a small project"],
                    "difficulty": "beginner" if order <= 4 else "intermediate",
                }
            )
            prev_id = nid
            order += 1
        if nodes:
            pid = unique_id(slugify(phase_title), seen_phase_ids)
            phases.append(
                {
                    "id": pid,
                    "title": phase_title,
                    "milestones": [f"Complete {phase_title.lower()} skills"],
                    "nodes": nodes,
                }
            )

    return {
        "schema_version": 1,
        "roadmap_version": f"{role_key}-v1",
        "role": display,
        "role_key": role_key,
        "role_aliases": [display],
        "summary": f"Full {display} path from zero to job-ready.",
        "phases": phases,
    }


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "app" / "data" / "roadmaps"
    out_dir.mkdir(parents=True, exist_ok=True)
    for role_key, (display, category) in _ROLE_REGISTRY.items():
        ladder = FOUNDATIONAL_LADDERS.get(category)
        if not ladder:
            print(f"skip {role_key}")
            continue
        doc = build_doc(role_key, display, ladder)
        path = out_dir / f"{role_key}.json"
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        n = sum(len(p["nodes"]) for p in doc["phases"])
        print(f"wrote {path.name} ({n} nodes)")


if __name__ == "__main__":
    main()
