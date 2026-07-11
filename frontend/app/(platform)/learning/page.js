"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import {
  generateCurriculum,
  getLatestCurriculum,
  getLatestRoadmap,
  isNotFound,
  updateCurriculumProgress,
  updateRoadmapNodeProgress,
  updateRoadmapProgress,
} from "@/lib/api";
import StudyTrackerChip from "@/components/learning/StudyTrackerChip";
import LessonModule from "@/components/learning/LessonModule";
import { useResourceStudyTracker } from "@/hooks/useResourceStudyTracker";

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

function buildTaskQueue(roadmap) {
  if (!roadmap?.weeks) return [];
  const queue = [];
  for (const week of roadmap.weeks) {
    for (let ti = 0; ti < (week.tasks || []).length; ti += 1) {
      const task = week.tasks[ti];
      const taskComplete = isTaskDone(roadmap.progress, week.week, ti);
      const resources = task.resources || [];
      if (resources.length === 0) {
        queue.push({ week: week.week, weekTheme: week.theme || `Week ${week.week}`, taskIndex: ti, task, resource: null, resourceIndex: null, taskComplete });
      } else {
        for (let ri = 0; ri < resources.length; ri += 1) {
          const resDone = isResourceDone(roadmap.progress, week.week, ti, ri);
          queue.push({ week: week.week, weekTheme: week.theme || `Week ${week.week}`, taskIndex: ti, task, resource: resources[ri], resourceIndex: ri, taskComplete, resourceComplete: resDone });
        }
      }
    }
  }
  return queue.sort((a, b) => {
    const aDone = a.resource ? a.resourceComplete : a.taskComplete;
    const bDone = b.resource ? b.resourceComplete : b.taskComplete;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.week !== b.week) return a.week - b.week;
    if (a.taskIndex !== b.taskIndex) return a.taskIndex - b.taskIndex;
    return (a.resourceIndex ?? 0) - (b.resourceIndex ?? 0);
  });
}

function isModuleDone(progress, sectionId, moduleId) {
  return (progress?.completed_modules || []).some((e) => e.key === `${sectionId}:${moduleId}`);
}

/** Curriculum view — personalized lessons + real per-skill study resources. */
function CurriculumView({ profileId, curriculum, setCurriculum, onRegenerate, regenerating }) {
  const [toggling, setToggling] = useState(null);

  const totalModules = curriculum.sections.reduce((sum, s) => sum + s.modules.length, 0);
  const completedModules = (curriculum.progress?.completed_modules || []).length;
  const pct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const toggleModule = async (sectionId, moduleId, forceDone, source = "manual") => {
    const key = `${sectionId}:${moduleId}`;
    setToggling(key);
    const markDone = forceDone ?? !isModuleDone(curriculum.progress, sectionId, moduleId);
    try {
      const updated = await updateCurriculumProgress(profileId, sectionId, moduleId, markDone, source);
      setCurriculum(updated);
    } catch {
      // non-fatal — leave state as-is, user can retry
    } finally {
      setToggling(null);
    }
  };

  return (
    <>
      <header className="mb-8 mask-reveal">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-display-lg text-on-surface">Your Learning Curriculum</h1>
            <p className="mt-2 max-w-2xl text-body-lg text-secondary">{curriculum.summary}</p>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="shrink-0 rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-60"
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-label-md font-bold text-primary">
            {completedModules}/{totalModules} done
          </span>
        </div>
      </header>

      <div className="space-y-8">
        {curriculum.sections.map((section) => (
          <section key={section.id}>
            <h3 className="mb-3 text-label-md font-bold uppercase tracking-wider text-primary">{section.title}</h3>
            <div className="space-y-3">
              {section.modules.map((module) => {
                const done = isModuleDone(curriculum.progress, section.id, module.id);
                const key = `${section.id}:${module.id}`;
                return (
                  <LessonModule
                    key={module.id}
                    module={module}
                    done={done}
                    isToggling={toggling === key}
                    onToggle={(forceDone, source) => toggleModule(section.id, module.id, forceDone, source)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** Fallback view — the roadmap-derived flat queue, used when no curriculum
 * exists yet or generation failed. */
function RoadmapQueueView({ profile, profileId, roadmap, setRoadmap }) {
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState(null);

  const isPathBased = Boolean(roadmap?.path);
  const nodeQueue = useMemo(() => buildNodeQueue(roadmap), [roadmap]);
  const taskQueue = useMemo(() => buildTaskQueue(roadmap), [roadmap]);

  const toggleNode = async (item, forceDone) => {
    const nodeId = item.node ? item.node.id : item;
    const markDone = forceDone ?? !item.isCompleted;
    setToggling(nodeId);
    try {
      setRoadmap(await updateRoadmapNodeProgress(profileId, nodeId, markDone));
    } catch (err) {
      setError(err);
    } finally {
      setToggling(null);
    }
  };

  const toggleTask = async (item, forceDone) => {
    const key = `${item.week}:${item.taskIndex}:${item.resourceIndex ?? "task"}`;
    setToggling(key);
    const markDone = forceDone ?? (!item.resource ? !item.taskComplete : !item.resourceComplete);
    try {
      setRoadmap(await updateRoadmapProgress(profileId, item.week, item.taskIndex, markDone, item.resourceIndex));
    } catch (err) {
      setError(err);
    } finally {
      setToggling(null);
    }
  };

  const studyTracker = useResourceStudyTracker({
    onComplete: async (tracked) => {
      if (tracked.nodeItem) await toggleNode(tracked.nodeItem, true);
      else if (tracked.taskItem) await toggleTask(tracked.taskItem, true);
    },
  });

  const queueLength = isPathBased ? nodeQueue.length : taskQueue.length;
  if (!roadmap || queueLength === 0) {
    return (
      <EmptyState
        icon="menu_book"
        title="No learning queue yet"
        description="Generate a roadmap from your skill gap to populate your learning queue."
        actionLabel="Go to Roadmap"
        actionHref="/roadmap"
      />
    );
  }

  const completedCount = isPathBased
    ? nodeQueue.filter((q) => q.isCompleted).length
    : taskQueue.length - taskQueue.filter((q) => !(q.resource ? q.resourceComplete : q.taskComplete)).length;
  const pct = queueLength > 0 ? Math.round((completedCount / queueLength) * 100) : 0;

  return (
    <>
      <header className="mb-8 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Your Learning Queue</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Real resources from your {isPathBased ? "skill path" : "roadmap"} for{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span>.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-surface-container-high">
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
                <div key={item.node.id} className={`card-hover flex items-center gap-4 rounded-2xl border bg-white p-5 transition-all ${item.isCompleted ? "border-outline-variant opacity-70" : "border-outline-variant"}`}>
                  <button type="button" onClick={() => toggleNode(item)} disabled={isToggling} aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${item.isCompleted ? "bg-primary text-on-primary" : "border-2 border-dashed border-outline-variant text-outline hover:border-primary"}`}>
                    <Icon name={item.isCompleted ? "check" : isToggling ? "hourglass_empty" : "radio_button_unchecked"} size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-label-sm font-bold uppercase tracking-wider text-primary">{item.phaseTitle}</p>
                    <p className="text-body-md font-semibold text-on-surface">{item.node.title || item.node.skill}</p>
                    {item.node.description && <p className="text-sm text-secondary line-clamp-1">{item.node.description}</p>}
                  </div>
                  {firstResource?.url && (
                    <a href={firstResource.url} target="_blank" rel="noopener noreferrer" onClick={() => studyTracker.startTracking({ key: `node:${item.node.id}`, title: firstResource.title, nodeItem: item })} className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary hover:bg-primary-container">
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
                <div key={key} className={`card-hover flex items-center gap-4 rounded-2xl border bg-white p-5 transition-all ${isDone ? "border-outline-variant opacity-70" : "border-outline-variant"}`}>
                  <button type="button" onClick={() => toggleTask(item)} disabled={isToggling} aria-label={isDone ? "Mark incomplete" : "Mark complete"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDone ? "bg-primary text-on-primary" : "border-2 border-dashed border-outline-variant text-outline hover:border-primary"}`}>
                    <Icon name={isDone ? "check" : isToggling ? "hourglass_empty" : "radio_button_unchecked"} size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Week {item.week} · {item.weekTheme}</p>
                    {item.resource ? (
                      <>
                        <p className="text-body-md font-semibold text-on-surface">{item.resource.title}</p>
                        <p className="text-sm text-secondary">{item.task.title || item.task.skill}{item.resource.duration ? ` · ${item.resource.duration}` : ""}</p>
                      </>
                    ) : (
                      <p className="text-body-md font-semibold text-on-surface">{item.task.title || item.task.skill}</p>
                    )}
                  </div>
                  {item.resource?.url && (
                    <a href={item.resource.url} target="_blank" rel="noopener noreferrer" onClick={() => studyTracker.startTracking({ key, title: item.resource.title, taskItem: item })} className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary hover:bg-primary-container">
                      <Icon name={RESOURCE_ICON[item.resource.type] || "menu_book"} size={18} />
                      Open
                    </a>
                  )}
                </div>
              );
            })}
      </div>

      <StudyTrackerChip active={studyTracker.active} pendingConfirm={studyTracker.pendingConfirm} onMarkDone={studyTracker.markDoneNow} onDismiss={studyTracker.dismiss} onConfirmYes={studyTracker.confirmYes} onConfirmNo={studyTracker.confirmNo} />
    </>
  );
}

export default function LearningPage() {
  const { profile, profileId } = useProfile();
  const [curriculum, setCurriculum] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [mode, setMode] = useState(null); // "curriculum" | "roadmap"
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [needsGap, setNeedsGap] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    getLatestCurriculum(profileId)
      .then((data) => {
        if (cancelled) return;
        setCurriculum(data);
        setMode("curriculum");
      })
      .catch((err) => {
        if (cancelled) return;
        if (!isNotFound(err)) setError(err);
        // No curriculum yet — fall back to the roadmap queue while offering generation.
        setMode("roadmap");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (mode !== "roadmap" || !profileId) return;
    let cancelled = false;
    getLatestRoadmap(profileId)
      .then((data) => {
        if (!cancelled) setRoadmap(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFound(err)) setNeedsGap(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, profileId]);

  const handleGenerate = async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateCurriculum(profileId, force);
      setCurriculum(data);
      setMode("curriculum");
    } catch (err) {
      setError(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState label="Loading your learning plan..." />;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-12">
      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      {mode === "curriculum" && curriculum && (
        <CurriculumView
          profileId={profileId}
          curriculum={curriculum}
          setCurriculum={setCurriculum}
          onRegenerate={() => handleGenerate(true)}
          regenerating={generating}
        />
      )}

      {mode === "roadmap" && !roadmap && !needsGap && (
        <div className="mb-8 flex flex-col items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8">
          <div>
            <h3 className="text-headline-md font-bold text-on-surface">Generate your learning curriculum</h3>
            <p className="mt-1 max-w-xl text-body-md text-secondary">
              A sectioned, self-paced curriculum built from your skill gap — grounded in real
              resources, not invented links.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="rounded-xl bg-primary px-6 py-3 text-label-md font-bold text-on-primary hover:bg-primary-container disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate My Curriculum"}
          </button>
        </div>
      )}

      {mode === "roadmap" && needsGap && (
        <EmptyState
          icon="route"
          title="Run a skill gap analysis first"
          description="Your learning plan is built from your skill gap — run that analysis first, then come back here."
          actionLabel="Go to Skill Gap"
          actionHref="/skill-gap"
        />
      )}

      {mode === "roadmap" && roadmap && (
        <RoadmapQueueView profile={profile} profileId={profileId} roadmap={roadmap} setRoadmap={setRoadmap} />
      )}

      {(mode === "curriculum" || (mode === "roadmap" && roadmap)) && (
        <div className="mt-8 flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-5">
          <p className="text-sm text-secondary">
            {mode === "curriculum" ? "Prefer the roadmap queue instead?" : "Prefer the generated curriculum?"}
          </p>
          {mode === "curriculum" ? (
            <button type="button" onClick={() => setMode("roadmap")} className="inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline">
              View roadmap queue
              <Icon name="arrow_forward" size={16} />
            </button>
          ) : (
            <button type="button" onClick={() => handleGenerate(false)} disabled={generating} className="inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline disabled:opacity-60">
              {generating ? "Generating..." : "Generate curriculum"}
              <Icon name="arrow_forward" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
