"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import RoadmapPathHeader from "@/components/roadmap/RoadmapPathHeader";
import RoadmapSkillPath from "@/components/roadmap/RoadmapSkillPath";
import StudyTrackerChip from "@/components/learning/StudyTrackerChip";
import { useResourceStudyTracker } from "@/hooks/useResourceStudyTracker";
import { useProfile } from "@/context/ProfileContext";
import {
  createRoadmap,
  getLatestRoadmap,
  isNotFound,
  updateRoadmapNodeProgress,
  updateRoadmapProgress,
} from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const TASK_TYPE_ICON = {
  course: "play_circle",
  project: "terminal",
  practice: "fitness_center",
};

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

export default function RoadmapPage() {
  const { profile, profileId } = useProfile();
  const cacheKey = `roadmap:${profileId}`;
  const initial = readCache(cacheKey);

  const [roadmap, setRoadmap] = useState(initial.data);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [needsGap, setNeedsGap] = useState(false);
  const [togglingNodeId, setTogglingNodeId] = useState(null);

  const load = async () => {
    if (!profileId) return;
    if (!roadmap) setLoading(true);
    setError(null);
    setNeedsGap(false);
    try {
      const data = await loadWithCache(cacheKey, () => getLatestRoadmap(profileId), CACHE_TTL.roadmap);
      setRoadmap(data);
      setExpanded({ [data.weeks[0]?.week]: true });
    } catch (err) {
      if (isNotFound(err)) {
        await generateFresh();
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateFresh = async (opts = {}) => {
    setGenerating(true);
    setError(null);
    try {
      const data = await createRoadmap(profileId, opts);
      setRoadmap(data);
      setExpanded({ [data.weeks[0]?.week]: true });
    } catch (err) {
      if (isNotFound(err)) {
        setNeedsGap(true);
      } else {
        setError(err);
      }
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const toggleWeek = (week) => setExpanded((prev) => ({ ...prev, [week]: !prev[week] }));

  // When a week just became fully complete, collapse it and open the next one
  // so finishing a week naturally hands the student their next step.
  const advanceIfWeekComplete = (updated, week) => {
    const weekObj = updated.weeks.find((w) => w.week === week);
    if (!weekObj) return;
    const doneInWeek = weekObj.tasks.filter((_, i) => isTaskDone(updated.progress, week, i)).length;
    if (doneInWeek === weekObj.tasks.length && weekObj.tasks.length > 0) {
      const nextWeek = updated.weeks.find((w) => w.week > week);
      setExpanded((prev) => ({
        ...prev,
        [week]: false,
        ...(nextWeek ? { [nextWeek.week]: true } : {}),
      }));
    }
  };

  const toggleTask = async (week, taskIndex) => {
    const markingDone = !isTaskDone(roadmap.progress, week, taskIndex);
    try {
      const updated = await updateRoadmapProgress(profileId, week, taskIndex, markingDone);
      setRoadmap(updated);
      if (markingDone) advanceIfWeekComplete(updated, week);
    } catch (err) {
      setError(err);
    }
  };

  const toggleResource = async (week, taskIndex, resourceIndex, forceDone) => {
    const markingDone = forceDone ?? !isResourceDone(roadmap.progress, week, taskIndex, resourceIndex);
    try {
      const updated = await updateRoadmapProgress(profileId, week, taskIndex, markingDone, resourceIndex);
      setRoadmap(updated);
      if (markingDone) advanceIfWeekComplete(updated, week);
    } catch (err) {
      setError(err);
    }
  };

  const toggleNode = async (nodeId, markingDone) => {
    setTogglingNodeId(nodeId);
    try {
      const updated = await updateRoadmapNodeProgress(profileId, nodeId, markingDone);
      setRoadmap(updated);
    } catch (err) {
      setError(err);
    } finally {
      setTogglingNodeId(null);
    }
  };

  // Open a learning resource in a new tab, track dwell time, and mark
  // progress complete on confirm or manual "Mark done" — instead of
  // requiring a blind manual checkbox click for every resource.
  const studyTracker = useResourceStudyTracker({
    onComplete: async (tracked) => {
      if (tracked.nodeId) {
        await toggleNode(tracked.nodeId, true);
      } else if (tracked.week != null) {
        await toggleResource(tracked.week, tracked.taskIndex, tracked.resourceIndex, true);
      }
    },
  });

  const openNodeResource = (node, resource) => {
    studyTracker.startTracking({ key: `node:${node.id}`, title: resource.title, nodeId: node.id });
  };

  const openTaskResource = (week, taskIndex, resourceIndex, resource) => {
    studyTracker.startTracking({
      key: `task:${week}:${taskIndex}:${resourceIndex}`,
      title: resource.title,
      week,
      taskIndex,
      resourceIndex,
    });
  };

  if ((loading && !roadmap) || generating) {
    return <LoadingState label={generating ? "Generating your roadmap..." : "Loading roadmap..."} />;
  }

  if (needsGap) {
    return (
      <div className="p-12">
        <EmptyState
          icon="route"
          title="Run a skill gap analysis first"
          description="Your roadmap is built from your skill gap report — run that analysis first, then come back here."
          actionLabel="Go to Skill Gap"
          actionHref="/skill-gap"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }

  if (!roadmap) return null;

  // New roadmaps carry a full roadmap.sh-style skill path from zero. Older
  // roadmaps only have the legacy week accordion — keep that working as-is.
  if (roadmap.path) {
    return (
      <div className="mx-auto max-w-container-max px-margin-desktop py-12">
        <RoadmapPathHeader path={roadmap.path} progress={roadmap.progress} targetRole={profile?.target_role} />

        <RoadmapSkillPath
          path={roadmap.path}
          progress={roadmap.progress}
          onToggleNode={toggleNode}
          togglingNodeId={togglingNodeId}
          onResourceOpen={openNodeResource}
        />

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <button
            type="button"
            onClick={() => generateFresh({ force_replan: true })}
            className="text-label-md text-secondary hover:text-primary hover:underline"
          >
            Regenerate path from latest skill gap
          </button>
          <Link href="/skill-gap" className="text-label-md text-secondary hover:text-primary hover:underline">
            Back to Skill Gap Analysis
          </Link>
        </div>

        <StudyTrackerChip
          active={studyTracker.active}
          pendingConfirm={studyTracker.pendingConfirm}
          onMarkDone={studyTracker.markDoneNow}
          onDismiss={studyTracker.dismiss}
          onConfirmYes={studyTracker.confirmYes}
          onConfirmNo={studyTracker.confirmNo}
        />
      </div>
    );
  }

  const completedCount = (roadmap.progress?.completed || []).length;
  const totalTasks = roadmap.weeks.reduce((sum, w) => sum + w.tasks.length, 0);
  const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const roadmapComplete = totalTasks > 0 && completedCount === totalTasks;

  return (
    <div className="mx-auto max-w-container-max px-margin-desktop py-12">
      {roadmapComplete && (
        <div className="mb-10 flex flex-col items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="celebration" filled />
            </div>
            <div>
              <h3 className="text-headline-md font-bold text-on-surface">Roadmap complete!</h3>
              <p className="text-body-md text-secondary">
                You&apos;ve finished every task. Re-run your skill gap analysis to see how much
                your readiness score has improved.
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

      <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="mb-2 text-display-lg text-on-surface">Your Career Roadmap</h3>
          <p className="max-w-2xl text-body-lg text-on-surface-variant">
            {roadmap.summary || `A ${roadmap.total_weeks}-week plan to close your skill gap for ${profile?.target_role}.`}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">
              Progress
            </p>
            <p className="text-headline-md font-bold text-primary">{pct}% Completed</p>
          </div>
          <div className="h-12 w-px bg-outline-variant" />
          <div className="text-right">
            <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">
              Total Duration
            </p>
            <p className="text-headline-md font-bold text-on-surface">
              {roadmap.total_weeks} weeks
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {roadmap.weeks.map((week) => {
          const doneInWeek = week.tasks.filter((_, i) => isTaskDone(roadmap.progress, week.week, i)).length;
          const weekComplete = doneInWeek === week.tasks.length && week.tasks.length > 0;
          return (
            <div
              key={week.week}
              className={`week-card group overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:shadow-ambient ${
                expanded[week.week] ? "expanded border-2 border-primary" : "border-outline-variant"
              }`}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-6 p-8 text-left"
                onClick={() => toggleWeek(week.week)}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    weekComplete ? "bg-green-50 text-green-600" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon name={weekComplete ? "check_circle" : "bolt"} filled />
                </div>
                <div className="flex-1">
                  <span className="mb-1 block text-label-md uppercase tracking-wider text-secondary">
                    Week {week.week} • {doneInWeek}/{week.tasks.length} tasks
                  </span>
                  <h4 className="text-headline-md font-semibold text-on-surface">{week.theme}</h4>
                </div>
                <div className="mr-4 flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-[11px] font-bold uppercase text-secondary">Hours</p>
                    <p className="text-label-md">{week.hours}h</p>
                  </div>
                  <Icon
                    name="expand_more"
                    className={`text-secondary transition-transform duration-300 ${expanded[week.week] ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {expanded[week.week] && (
                <div className="border-t border-outline-variant/30 p-8 pt-6">
                  <div className="space-y-3">
                    {week.tasks.map((task, i) => {
                      const done = isTaskDone(roadmap.progress, week.week, i);
                      const resources = task.resources || [];
                      const hasResources = resources.length > 0;
                      return (
                        <div
                          key={`${task.title}-${i}`}
                          className={`rounded-xl border p-4 ${
                            done ? "border-green-200 bg-green-50/50" : "border-outline-variant bg-surface-bright"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={() => !hasResources && toggleTask(week.week, i)}
                              disabled={hasResources}
                              title={hasResources ? "Completes automatically when all resources are done" : "Mark task complete"}
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                done ? "border-green-500 bg-green-500 text-white" : "border-outline-variant"
                              } ${hasResources ? "cursor-default" : ""}`}
                            >
                              {done && <Icon name="check" size={14} />}
                            </button>
                            <Icon
                              name={TASK_TYPE_ICON[task.type] || "task_alt"}
                              className={done ? "text-green-600" : "text-primary"}
                            />
                            <div className="flex-1">
                              <p className={`text-label-md font-bold ${done ? "text-secondary line-through" : "text-on-surface"}`}>
                                {task.title}
                              </p>
                              <p className="text-sm text-secondary">
                                <span className="uppercase">{task.skill}</span>
                                {hasResources && (
                                  <>
                                    {" • "}
                                    {resources.filter((_, ri) => isResourceDone(roadmap.progress, week.week, i, ri)).length}
                                    /{resources.length} resources done
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {hasResources && (
                            <div className="mt-4 space-y-2 pl-10">
                              {resources.map((res, ri) => {
                                const resDone = isResourceDone(roadmap.progress, week.week, i, ri);
                                return (
                                  <div
                                    key={`${res.url}-${ri}`}
                                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                                      resDone ? "border-green-200 bg-green-50/40" : "border-outline-variant bg-white"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleResource(week.week, i, ri)}
                                      title={resDone ? "Mark as not done" : "Mark as completed"}
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                        resDone ? "border-green-500 bg-green-500 text-white" : "border-outline-variant"
                                      }`}
                                    >
                                      {resDone && <Icon name="check" size={12} />}
                                    </button>
                                    <Icon
                                      name={RESOURCE_ICON[res.type] || "link"}
                                      size={18}
                                      className={resDone ? "text-green-600" : "text-primary"}
                                    />
                                    <a
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => !resDone && openTaskResource(week.week, i, ri, res)}
                                      className="flex-1 min-w-0"
                                    >
                                      <p className={`truncate text-sm font-semibold ${resDone ? "text-secondary line-through" : "text-on-surface hover:text-primary"}`}>
                                        {res.title}
                                      </p>
                                      <p className="truncate text-xs text-secondary">
                                        {res.provider}
                                        {res.duration ? ` • ${res.duration}` : ""}
                                        {" • "}
                                        <span className="uppercase">{res.type}</span>
                                      </p>
                                    </a>
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        res.cost === "paid"
                                          ? "bg-tertiary-fixed text-on-tertiary-fixed"
                                          : "bg-primary/10 text-primary"
                                      }`}
                                    >
                                      {res.cost}
                                    </span>
                                    <a
                                      href={res.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 text-secondary hover:text-primary"
                                      title="Open resource"
                                    >
                                      <Icon name="open_in_new" size={16} />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <Link href="/skill-gap" className="text-label-md text-secondary hover:text-primary hover:underline">
          Back to Skill Gap Analysis
        </Link>
      </div>

      <StudyTrackerChip
        active={studyTracker.active}
        pendingConfirm={studyTracker.pendingConfirm}
        onMarkDone={studyTracker.markDoneNow}
        onDismiss={studyTracker.dismiss}
        onConfirmYes={studyTracker.confirmYes}
        onConfirmNo={studyTracker.confirmNo}
      />
    </div>
  );
}
