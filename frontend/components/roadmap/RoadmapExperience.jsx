"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import InAppResourceViewer from "@/components/learning/InAppResourceViewer";
import RoadmapCanvas from "./RoadmapCanvas";
import RoadmapProgressHeader from "./RoadmapProgressHeader";
import {
  buildLegacyCanvasModel,
  buildPathCanvasModel,
  isResourceDone,
  isTaskDone,
} from "@/lib/roadmapCanvasModel";

export function PathRoadmapView({
  roadmap,
  profile,
  onToggleNode,
  togglingNodeId,
  onRegenerate,
}) {
  const autoCompleted = roadmap.progress?.auto_completed || [];
  const knownFromProfile = autoCompleted.filter((e) =>
    (roadmap.progress?.completed_nodes || []).includes(e.node_id)
  ).length;

  const { sections, nodes, stats } = buildPathCanvasModel(roadmap.path, roadmap.progress);

  return (
    <>
      <RoadmapProgressHeader
        title={`Your Full ${profile?.target_role || ""} Path`.trim()}
        summary={roadmap.path?.summary || `Every skill you need for ${profile?.target_role}, from zero to job-ready.`}
        stats={stats}
        targetRole={profile?.target_role}
        knownFromProfile={knownFromProfile}
      />

      <RoadmapCanvas
        sections={sections}
        nodes={nodes}
        onToggleNode={onToggleNode}
        togglingId={togglingNodeId}
      />

      <footer className="mt-10 flex flex-col items-center gap-4 text-center">
        <button
          type="button"
          onClick={onRegenerate}
          className="text-label-md text-secondary transition-colors hover:text-primary hover:underline"
        >
          Regenerate path from latest skill gap
        </button>
        <Link href="/skill-gap" className="text-label-md text-secondary transition-colors hover:text-primary hover:underline">
          Back to Skill Gap Analysis
        </Link>
      </footer>
    </>
  );
}

export function LegacyRoadmapView({
  roadmap,
  profile,
  onToggleTask,
  onOpenTaskResource,
  activeResource,
  onCloseResource,
  onResourceStudied,
  completingResource,
}) {
  const { sections, nodes, stats } = buildLegacyCanvasModel(roadmap.weeks, roadmap.progress);
  const roadmapComplete = stats.total > 0 && stats.completed === stats.total;

  const handleToggleLegacy = async (node, markDone) => {
    const { week, taskIndex } = node.meta;
    const done = isTaskDone(roadmap.progress, week, taskIndex);
    if (markDone === done) return;
    if ((node.resources || []).length > 0 && markDone) return;
    await onToggleTask(week, taskIndex);
  };

  return (
    <>
      {roadmapComplete && (
        <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="celebration" filled />
            </div>
            <div>
              <h3 className="text-headline-md font-bold text-on-surface">Roadmap complete!</h3>
              <p className="text-body-md text-secondary">
                You&apos;ve finished every task. Re-run your skill gap analysis to see how much your readiness improved.
              </p>
            </div>
          </div>
          <Link
            href="/skill-gap"
            className="shrink-0 rounded-xl bg-primary px-6 py-3 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container"
          >
            Re-run Skill Gap Analysis
          </Link>
        </div>
      )}

      <RoadmapProgressHeader
        title="Your Career Roadmap"
        summary={roadmap.summary || `A ${roadmap.total_weeks}-week plan to close your skill gap for ${profile?.target_role}.`}
        stats={stats}
        targetRole={profile?.target_role}
        extraLabel={`${roadmap.total_weeks} week plan`}
      />

      <RoadmapCanvas
        sections={sections}
        nodes={nodes}
        onToggleLegacy={handleToggleLegacy}
        onOpenLegacyResource={(node, resourceIndex, resource) =>
          onOpenTaskResource(node.meta.week, node.meta.taskIndex, resourceIndex, resource)
        }
        isResourceDone={(node, ri) => isResourceDone(roadmap.progress, node.meta.week, node.meta.taskIndex, ri)}
      />

      <InAppResourceViewer
        key={activeResource?.resource?.url ?? "legacy-resource"}
        resource={activeResource?.resource}
        onClose={onCloseResource}
        onComplete={onResourceStudied}
        completing={completingResource}
      />

      <footer className="mt-10 flex justify-center">
        <Link href="/skill-gap" className="text-label-md text-secondary transition-colors hover:text-primary hover:underline">
          Back to Skill Gap Analysis
        </Link>
      </footer>
    </>
  );
}

export { isTaskDone, isResourceDone };
