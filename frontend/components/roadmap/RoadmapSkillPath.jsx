"use client";

import RoadmapCanvas from "./RoadmapCanvas";
import { buildPathCanvasModel } from "@/lib/roadmapCanvasModel";

/** roadmap.sh-style skill path — rendered on the interactive canvas. */
export default function RoadmapSkillPath({ path, progress, onToggleNode, togglingNodeId }) {
  const { sections, nodes } = buildPathCanvasModel(path, progress);

  return (
    <RoadmapCanvas
      sections={sections}
      nodes={nodes}
      onToggleNode={onToggleNode}
      togglingId={togglingNodeId}
    />
  );
}
