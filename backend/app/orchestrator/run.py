"""Standalone runner for the intake -> gap -> roadmap -> save graph.

Usage:
    uv run python -m app.orchestrator.run --profile-id <uuid>
    uv run python -m app.orchestrator.run --profile-id <uuid> --no-roadmap
    uv run python -m app.orchestrator.run --profile-id <uuid> --no-narrative
"""

from __future__ import annotations

import argparse
import asyncio
import json

from app.orchestrator.graph import build_career_graph


async def run_career_pipeline(
    profile_id: str,
    *,
    interview_session_id: str | None = None,
    practice_session_id: str | None = None,
    include_narrative: bool = True,
    run_roadmap: bool = True,
    n_jobs: int | None = None,
) -> dict:
    graph = build_career_graph()
    return await graph.ainvoke(
        {
            "profile_id": profile_id,
            "interview_session_id": interview_session_id,
            "practice_session_id": practice_session_id,
            "include_narrative": include_narrative,
            "run_roadmap": run_roadmap,
            "n_jobs": n_jobs,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the intake -> gap -> roadmap -> save career pipeline")
    parser.add_argument("--profile-id", required=True)
    parser.add_argument("--interview-session-id", default=None)
    parser.add_argument("--practice-session-id", default=None)
    parser.add_argument("--no-roadmap", action="store_true")
    parser.add_argument("--no-narrative", action="store_true")
    args = parser.parse_args()

    result = asyncio.run(
        run_career_pipeline(
            args.profile_id,
            interview_session_id=args.interview_session_id,
            practice_session_id=args.practice_session_id,
            include_narrative=not args.no_narrative,
            run_roadmap=not args.no_roadmap,
        )
    )

    if result.get("error"):
        print("ERROR:", result["error"])
        return

    gap = result.get("skill_gap") or {}
    print(f"snapshot_id:  {result.get('snapshot_id')}")
    print(f"roadmap_id:   {result.get('roadmap_id')}")
    print(f"gap_size:     {result.get('gap_size')}")
    print(f"readiness:    {gap.get('readiness_score')}")
    print(f"priority top5: {[r['skill'] for r in gap.get('priority_learn', [])[:5]]}")
    if result.get("narrative_summary"):
        print(f"\nnarrative:\n{result['narrative_summary']}")
    if result.get("roadmap"):
        print(f"\nroadmap ({result['roadmap']['total_weeks']} weeks):")
        for week in result["roadmap"]["weeks"]:
            print(f"  Week {week['week']}: {week['theme']} ({week['hours']}h)")
    print("\nfull state (minus skill_gap, for brevity):")
    print(json.dumps({k: v for k, v in result.items() if k not in ("skill_gap", "roadmap")}, indent=2, default=str))


if __name__ == "__main__":
    main()
