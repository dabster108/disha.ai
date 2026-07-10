"use client";

import Icon from "@/components/ui/Icon";

/**
 * Overall skill-path progress: % bar, "X of Y skills" and how many were
 * already known from the student's profile — mirrors roadmap.sh's top
 * summary strip above the vertical path.
 */
export default function RoadmapPathHeader({ path, progress, targetRole }) {
  const allNodes = (path?.phases || []).flatMap((phase) => phase.nodes || []);
  const total = allNodes.length;
  const completedIds = new Set(progress?.completed_nodes || []);
  const autoIds = new Set((progress?.auto_completed || []).map((entry) => entry.node_id));
  const completed = allNodes.filter((node) => completedIds.has(node.id)).length;
  const known = allNodes.filter((node) => autoIds.has(node.id) && completedIds.has(node.id)).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h3 className="mb-2 text-display-lg text-on-surface">Your Full {targetRole} Path</h3>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          {path?.summary || `Every skill you need for ${targetRole}, from zero to job-ready.`}
        </p>
        {known > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Icon name="verified" size={16} filled />
            {known} skill{known === 1 ? "" : "s"} already ticked from your profile
          </p>
        )}
      </div>
      <div className="flex gap-4">
        <div className="text-right">
          <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">Progress</p>
          <p className="text-headline-md font-bold text-primary">{pct}%</p>
        </div>
        <div className="h-12 w-px bg-outline-variant" />
        <div className="text-right">
          <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">Skills</p>
          <p className="text-headline-md font-bold text-on-surface">
            {completed}/{total}
          </p>
        </div>
      </div>
    </div>
  );
}
