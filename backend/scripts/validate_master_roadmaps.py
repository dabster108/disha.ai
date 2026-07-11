"""CI helper: validate all master roadmap JSON files."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.services.master_roadmap import ROADMAPS_DIR, _load_json_file, validate_dependency_dag  # noqa: E402
from app.services.skill_gap import normalize_skill_name  # noqa: E402


def main() -> int:
    if not ROADMAPS_DIR.is_dir():
        print(f"Missing roadmaps dir: {ROADMAPS_DIR}")
        return 1

    errors: list[str] = []
    for path in sorted(ROADMAPS_DIR.glob("*.json")):
        try:
            doc = _load_json_file(str(path), path.stat().st_mtime_ns)
            validate_dependency_dag(doc.phases)
            seen_ids: set[str] = set()
            for phase in doc.phases:
                for node in phase.nodes:
                    if node.id in seen_ids:
                        errors.append(f"{path.name}: duplicate node id {node.id!r}")
                    seen_ids.add(node.id)
                    if not normalize_skill_name(node.skill):
                        errors.append(f"{path.name}: empty skill on node {node.id!r}")
        except Exception as exc:
            errors.append(f"{path.name}: {exc}")

    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1

    print(f"OK: {len(list(ROADMAPS_DIR.glob('*.json')))} master roadmaps validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
