"""LangGraph pipeline: intake -> gap -> [route] -> roadmap? -> save -> END.

Only gap (narrative) and roadmap touch an LLM; intake and save are plain async
DB nodes. route_after_gap reads gap_size (computed once, in gap_node, via
app.services.roadmap.classify_gap_size) rather than re-deriving the large/small
threshold — roadmap depth is decided from the same field, so the large/small
cutoff exists in exactly one place.

The "full_roadmap"/"compact_roadmap" split described in the original design
collapses to a single "roadmap" edge here: both would route to the same node
regardless, and gap_size already drives depth inside roadmap_node — a second
branch pointing at the identical destination added no behavior, only
indirection, so it's merged into one outcome (documented in
OPTIMIZATION_NOTES.md).
"""

from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.orchestrator.nodes.gap import gap_node
from app.orchestrator.nodes.intake import intake_node
from app.orchestrator.nodes.roadmap import roadmap_node
from app.orchestrator.nodes.save import save_node
from app.orchestrator.state import CareerState


def route_after_gap(state: CareerState) -> str:
    if state.get("error"):
        return "end"
    if not state.get("run_roadmap", True):
        return "save_only"
    return "roadmap"


@lru_cache
def build_career_graph():
    graph = StateGraph(CareerState)
    graph.add_node("intake", intake_node)
    graph.add_node("gap", gap_node)
    graph.add_node("roadmap", roadmap_node)
    graph.add_node("save", save_node)

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "gap")
    graph.add_conditional_edges(
        "gap",
        route_after_gap,
        {
            "roadmap": "roadmap",
            "save_only": "save",
            "end": END,
        },
    )
    graph.add_edge("roadmap", "save")
    graph.add_edge("save", END)
    return graph.compile()


# Backward-compatible name used by the original orchestrator skeleton.
build_graph = build_career_graph
