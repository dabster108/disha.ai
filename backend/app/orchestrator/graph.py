"""LangGraph skeleton: intake -> gap -> roadmap.

Only the gap node does real work for now; the roadmap node is a stub until
steps 5/6. Kept as a graph (not a linear chain) so branching — e.g. large
gap -> longer roadmap, small gap -> interview prep — can be added later.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.orchestrator.nodes.gap import gap_node
from app.orchestrator.nodes.roadmap import roadmap_node
from app.orchestrator.state import CareerState


def build_graph():
    graph = StateGraph(CareerState)
    graph.add_node("gap", gap_node)
    graph.add_node("roadmap", roadmap_node)
    graph.add_edge(START, "gap")
    graph.add_edge("gap", "roadmap")
    graph.add_edge("roadmap", END)
    return graph.compile()
