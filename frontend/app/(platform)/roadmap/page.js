"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useProfile } from "@/context/ProfileContext";
import { createRoadmap, getLatestRoadmap, isNotFound, updateRoadmapProgress } from "@/lib/api";

const TASK_TYPE_ICON = {
  course: "play_circle",
  project: "terminal",
  practice: "fitness_center",
};

function isTaskDone(progress, week, taskIndex) {
  return (progress?.completed || []).some((e) => e.week === week && e.task_index === taskIndex);
}

export default function RoadmapPage() {
  const { profile, profileId } = useProfile();

  const [roadmap, setRoadmap] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [needsGap, setNeedsGap] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setNeedsGap(false);
    try {
      const data = await getLatestRoadmap(profileId);
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

  const toggleTask = async (week, taskIndex) => {
    const done = isTaskDone(roadmap.progress, week, taskIndex);
    const markingDone = !done;
    try {
      const updated = await updateRoadmapProgress(profileId, week, taskIndex, markingDone);
      setRoadmap(updated);

      if (markingDone) {
        const weekObj = updated.weeks.find((w) => w.week === week);
        const doneInWeek = weekObj.tasks.filter((_, i) => isTaskDone(updated.progress, week, i)).length;
        if (doneInWeek === weekObj.tasks.length) {
          // Week just completed — collapse it and open whatever's next, so
          // finishing a week naturally hands the student their next step.
          const nextWeek = updated.weeks.find((w) => w.week > week);
          setExpanded((prev) => ({
            ...prev,
            [week]: false,
            ...(nextWeek ? { [nextWeek.week]: true } : {}),
          }));
        }
      }
    } catch (err) {
      setError(err);
    }
  };

  if (loading || generating) {
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
                      return (
                        <div
                          key={`${task.title}-${i}`}
                          className={`flex items-start gap-4 rounded-xl border p-4 ${
                            done ? "border-green-200 bg-green-50/50" : "border-outline-variant bg-surface-bright"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTask(week.week, i)}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              done ? "border-green-500 bg-green-500 text-white" : "border-outline-variant"
                            }`}
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
                              {task.resource} • <span className="uppercase">{task.skill}</span>
                            </p>
                          </div>
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
        <button
          type="button"
          onClick={() => generateFresh({ force_replan: true })}
          disabled={generating}
          className="group inline-flex items-center gap-3 rounded-2xl border border-outline-variant bg-white px-10 py-4 font-bold text-on-surface shadow-sm transition-all hover:shadow-md disabled:opacity-60"
        >
          <Icon name="auto_awesome" className="text-primary transition-transform group-hover:rotate-12" />
          Regenerate Roadmap
        </button>
        <Link href="/skill-gap" className="text-label-md text-secondary hover:text-primary hover:underline">
          Back to Skill Gap Analysis
        </Link>
      </div>
    </div>
  );
}
