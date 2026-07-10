"use client";

import SkillNode from "./SkillNode";

/**
 * roadmap.sh-style vertical skill path: dot-grid background, a dashed
 * connector running behind the node circles, phases as section headers.
 * Soft progression — every node stays clickable regardless of status.
 */
export default function RoadmapSkillPath({ path, progress, onToggleNode, togglingNodeId }) {
  const phases = path?.phases || [];
  const autoCompletedByNode = new Map((progress?.auto_completed || []).map((entry) => [entry.node_id, entry]));

  return (
    <div className="roadmap-grid rounded-3xl border border-outline-variant bg-white p-6 md:p-10">
      <div className="relative mx-auto max-w-2xl">
        <div className="node-connector absolute bottom-2 left-5 top-2 w-0.5" />
        <div className="flex flex-col gap-8">
          {phases.map((phase) => (
            <div key={phase.id}>
              <h3 className="relative z-10 mb-4 inline-flex items-center gap-2 rounded-full bg-on-surface px-4 py-1.5 text-label-md font-bold text-white">
                {phase.title}
              </h3>
              <div className="flex flex-col gap-3">
                {(phase.nodes || []).map((node) => (
                  <SkillNode
                    key={node.id}
                    node={node}
                    autoCompleted={autoCompletedByNode.get(node.id)}
                    onToggle={onToggleNode}
                    isToggling={togglingNodeId === node.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
