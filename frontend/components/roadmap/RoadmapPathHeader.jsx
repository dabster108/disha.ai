"use client";

import RoadmapProgressHeader from "./RoadmapProgressHeader";
import { buildPathCanvasModel } from "@/lib/roadmapCanvasModel";

/** Overall skill-path progress strip above the canvas. */
export default function RoadmapPathHeader({ path, progress, targetRole }) {
  const autoCompleted = progress?.auto_completed || [];
  const knownFromProfile = autoCompleted.filter((e) =>
    (progress?.completed_nodes || []).includes(e.node_id)
  ).length;
  const { stats } = buildPathCanvasModel(path, progress);

  return (
    <RoadmapProgressHeader
      title={`Your Full ${targetRole || ""} Path`.trim()}
      summary={path?.summary || `Every skill you need for ${targetRole}, from zero to job-ready.`}
      stats={stats}
      targetRole={targetRole}
      knownFromProfile={knownFromProfile}
    />
  );
}
