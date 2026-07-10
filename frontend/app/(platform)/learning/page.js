"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { getLatestRoadmap, isNotFound, updateRoadmapNodeProgress, updateRoadmapProgress } from "@/lib/api";

const RESOURCE_ICON = {
  video: "play_circle",
  article: "article",
  docs: "menu_book",
  course: "school",
  practice: "fitness_center",
};

function isTaskDone(progress, week, taskIndex) {
  return (progress?.completed || []).some((e) => e.week === week && e.task_index === taskIndex);
}

function isResourceDone(progress, week, taskIndex, resourceIndex) {
  return (progress?.resources_completed || []).some(
    (e) => e.week === week && e.task_index === taskIndex && e.resource_index === resourceIndex
  );
}

/** Flatten the skill path into a learning queue: incomplete nodes first,
 *  then completed ones, in path order within each group. */
function buildNodeQueue(roadmap) {
  if (!roadmap?.path?.phases) return [];
  const completedIds = new Set(roadmap.progress?.completed_nodes || []);
  const queue = (roadmap.path.phases || []).flatMap((phase) =>
    (phase.nodes || []).map((node) => ({
      node,
      phaseTitle: phase.title,
      isCompleted: completedIds.has(node.id),
    }))
  );
  return queue.sort((a, b) => (a.isCompleted === b.isCompleted ? 0 : a.isCompleted ? 1 : -1));
}

/** Flatten the legacy week roadmap into a learning queue: incomplete tasks +
 *  their incomplete resources, ordered by week then task index. */
function buildTaskQueue(roadmap) {
  if (!roadmap?.weeks) return [];
  const queue = [];
  for (const week of roadmap.weeks) {
    for (let ti = 0; ti < (week.tasks || []).length; ti += 1) {
      const task = week.tasks[ti];
      const taskComplete = isTaskDone(roadmap.progress, week.week, ti);
      const resources = task.resources || [];
      if (resources.length === 0) {
        queue.push({
          week: week.week,
          weekTheme: week.theme || `Week ${week.week}`,
          taskIndex: ti,
          task,
          resource: null,
          resourceIndex: null,
          taskComplete,
        });
      } else {
        for (let ri = 0; ri < resources.length; ri += 1) {
          const resDone = isResourceDone(roadmap.progress, week.week, ti, ri);
          queue.push({
            week: week.week,
            weekTheme: week.theme || `Week ${week.week}`,
            taskIndex: ti,
            task,
            resource: resources[ri],
            resourceIndex: ri,
            taskComplete,
            resourceComplete: resDone,
          });
        }
      }
    }
  }
  // Incomplete first, then by week/task/resource order.
  return queue.sort((a, b) => {
    const aDone = a.resource ? a.resourceComplete : a.taskComplete;
    const bDone = b.resource ? b.resourceComplete : b.taskComplete;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.week !== b.week) return a.week - b.week;
    if (a.taskIndex !== b.taskIndex) return a.taskIndex - b.taskIndex;
    return (a.resourceIndex ?? 0) - (b.resourceIndex ?? 0);
  });
}

export default function LearningPage() {
  const { profile, profileId } = useProfile();
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsGap, setNeedsGap] = useState(false);
  const [toggling, setToggling] = useState(null); // node id, or `${week}:${taskIndex}:${resourceIndex|task}`

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    getLatestRoadmap(profileId)
      .then((data) => {
        if (cancelled) return;
        setRoadmap(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFound(err)) setNeedsGap(true);
        else setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const isPathBased = Boolean(roadmap?.path);
  const nodeQueue = useMemo(() => buildNodeQueue(roadmap), [roadmap]);
  const taskQueue = useMemo(() => buildTaskQueue(roadmap), [roadmap]);

  const toggleNode = async (item) => {
    setToggling(item.node.id);
    try {
      const updated = await updateRoadmapNodeProgress(profileId, item.node.id, !item.isCompleted);
      setRoadmap(updated);
    } catch (err) {
      setError(err);
    } finally {
      setToggling(null);
    }
  };

  const toggleTask = async (item) => {
    const key = `${item.week}:${item.taskIndex}:${item.resourceIndex ?? "task"}`;
    setToggling(key);
    try {
      const updated = await updateRoadmapProgress(
        profileId,
        item.week,
        item.taskIndex,
        !item.resource ? !item.taskComplete : !item.resourceComplete,
        item.resourceIndex
      );
      setRoadmap(updated);
    } catch (err) {
      setError(err);
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <LoadingState label="Loading your learning queue..." />;

  if (needsGap) {
    return (
      <div className="p-12">
        <EmptyState
          icon="route"
          title="Run a skill gap analysis first"
          description="Your learning queue is built from your roadmap — and your roadmap is built from your skill gap. Start there."
          actionLabel="Go to Skill Gap"
          actionHref="/skill-gap"
        />
      </div>
    );
  }

  if (error && !roadmap) {
    return (
      <div className="p-12">
        <ErrorBanner message={error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const queueLength = isPathBased ? nodeQueue.length : taskQueue.length;

  if (!roadmap || queueLength === 0) {
    return (
      <div className="p-12">
        <EmptyState
          icon="menu_book"
          title="No learning queue yet"
          description="Generate a roadmap from your skill gap to populate your learning queue."
          actionLabel="Go to Roadmap"
          actionHref="/roadmap"
        />
      </div>
    );
  }

  const completedCount = isPathBased
    ? nodeQueue.filter((q) => q.isCompleted).length
    : taskQueue.length - taskQueue.filter((q) => !(q.resource ? q.resourceComplete : q.taskComplete)).length;
  const pct = queueLength > 0 ? Math.round((completedCount / queueLength) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-12">
      <header className="mb-8 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Your Learning Queue</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Real resources from your {isPathBased ? "skill path" : "roadmap"} for{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span>. Mark items complete as you
          finish them — your progress updates instantly.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-label-md font-bold text-primary">{completedCount}/{queueLength} done</span>
        </div>
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="space-y-3">
        {isPathBased
          ? nodeQueue.map((item) => {
              const isToggling = toggling === item.node.id;
              const firstResource = item.node.resources?.[0];
              return (
                <div
                  key={item.node.id}
                  className={`card-hover flex items-center gap-4 rounded-2xl border bg-white p-5 transition-all ${
                    item.isCompleted ? "border-outline-variant opacity-70" : "border-outline-variant"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleNode(item)}
                    disabled={isToggling}
                    aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      item.isCompleted
                        ? "bg-primary text-on-primary"
                        : "border-2 border-dashed border-outline-variant text-outline hover:border-primary"
                    }`}
                  >
                    <Icon
                      name={item.isCompleted ? "check" : isToggling ? "hourglass_empty" : "radio_button_unchecked"}
                      size={20}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-label-sm font-bold uppercase tracking-wider text-primary">{item.phaseTitle}</p>
                    <p className="text-body-md font-semibold text-on-surface">
                      {item.node.title || item.node.skill}
                    </p>
                    {item.node.description && (
                      <p className="text-sm text-secondary line-clamp-1">{item.node.description}</p>
                    )}
                  </div>

                  {firstResource?.url && (
                    <a
                      href={firstResource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary hover:bg-primary-container"
                    >
                      <Icon name={RESOURCE_ICON[firstResource.type] || "menu_book"} size={18} />
                      Open
                    </a>
                  )}
                </div>
              );
            })
          : taskQueue.map((item) => {
              const isDone = item.resource ? item.resourceComplete : item.taskComplete;
              const key = `${item.week}:${item.taskIndex}:${item.resourceIndex ?? "task"}`;
              const isToggling = toggling === key;
              return (
                <div
                  key={key}
                  className={`card-hover flex items-center gap-4 rounded-2xl border bg-white p-5 transition-all ${
                    isDone ? "border-outline-variant opacity-70" : "border-outline-variant"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(item)}
                    disabled={isToggling}
                    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isDone
                        ? "bg-primary text-on-primary"
                        : "border-2 border-dashed border-outline-variant text-outline hover:border-primary"
                    }`}
                  >
                    <Icon name={isDone ? "check" : isToggling ? "hourglass_empty" : "radio_button_unchecked"} size={20} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-label-sm font-bold uppercase tracking-wider text-primary">
                      Week {item.week} · {item.weekTheme}
                    </p>
                    {item.resource ? (
                      <>
                        <p className="text-body-md font-semibold text-on-surface">{item.resource.title}</p>
                        <p className="text-sm text-secondary">
                          {item.task.title || item.task.skill}
                          {item.resource.duration ? ` · ${item.resource.duration}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-body-md font-semibold text-on-surface">
                        {item.task.title || item.task.skill}
                      </p>
                    )}
                  </div>

                  {item.resource?.url && (
                    <a
                      href={item.resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary hover:bg-primary-container"
                    >
                      <Icon name={RESOURCE_ICON[item.resource.type] || "menu_book"} size={18} />
                      Open
                    </a>
                  )}
                </div>
              );
            })}
      </div>

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-5">
        <p className="text-sm text-secondary">Prefer the full path view?</p>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline"
        >
          Open roadmap
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    </div>
  );
}
