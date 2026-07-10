"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

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

/**
 * The "what's next" card — the most important dashboard element. Shows the
 * next skill node (roadmap.sh-style path) or, for legacy roadmaps, the
 * active week/task — mirroring the roadmap page so the dashboard card and
 * the roadmap page always tell the same story.
 */
export default function RoadmapWeekCard({ roadmap, progress }) {
  if (!roadmap) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-white p-8 text-center">
        <Icon name="route" className="mb-3 text-secondary" size={32} />
        <h3 className="mb-1 text-headline-sm font-bold text-on-surface">No roadmap yet</h3>
        <p className="mb-4 text-body-md text-secondary">
          Generate a roadmap from your skill gap to get a full skill path with real resources.
        </p>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary"
        >
          Generate roadmap
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    );
  }

  if (progress.isPathBased) {
    const node = progress.nextNode;
    return (
      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Skill path progress</p>
            <h3 className="mt-1 text-headline-md font-bold text-on-surface">
              {node ? node.title || node.skill : "Path complete!"}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-headline-md font-bold text-primary">{progress.pct}%</p>
            <p className="text-xs text-secondary">
              {progress.completedTasks}/{progress.totalTasks} skills
            </p>
          </div>
        </div>

        <div className="mb-4 h-1.5 w-full rounded-full bg-surface-container-low">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
        </div>

        {node ? (
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4">
            <p className="mb-1 text-label-sm font-bold uppercase tracking-wider text-secondary">Next up</p>
            <div className="flex items-start gap-3">
              <Icon name="bolt" size={20} className="mt-0.5 shrink-0 text-primary" filled />
              <div className="min-w-0">
                <p className="font-semibold text-on-surface">{node.title || node.skill}</p>
                {node.description && <p className="mt-1 text-sm text-secondary line-clamp-2">{node.description}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface">
            <p className="flex items-center gap-2 font-semibold text-primary">
              <Icon name="celebration" size={18} filled />
              You&apos;ve completed every skill in your path
            </p>
          </div>
        )}

        <Link
          href="/roadmap"
          className="mt-4 inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline"
        >
          Continue learning
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    );
  }

  const week = progress.currentWeek || roadmap.weeks?.[0];
  if (!week) return null;

  const tasks = week.tasks || [];
  const doneInWeek = tasks.filter((_, i) =>
    (roadmap.progress?.completed || []).some((e) => e.week === week.week && e.task_index === i)
  ).length;
  const weekPct = tasks.length > 0 ? Math.round((doneInWeek / tasks.length) * 100) : 0;

  const nextTask = progress.nextTask;
  const nextTaskObj = nextTask?.task;
  const firstResource = nextTaskObj?.resources?.[0];

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">
            Week {week.week} of {roadmap.total_weeks ?? "?"}
          </p>
          <h3 className="mt-1 text-headline-md font-bold text-on-surface">
            {week.theme || week.title || `Week ${week.week}`}
          </h3>
          {week.hours && (
            <p className="mt-1 flex items-center gap-1 text-sm text-secondary">
              <Icon name="schedule" size={14} />
              {week.hours} hours
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-headline-md font-bold text-primary">{weekPct}%</p>
          <p className="text-xs text-secondary">{doneInWeek}/{tasks.length} tasks</p>
        </div>
      </div>

      <div className="mb-4 h-1.5 w-full rounded-full bg-surface-container-low">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${weekPct}%` }} />
      </div>

      {nextTaskObj ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4">
          <p className="mb-1 text-label-sm font-bold uppercase tracking-wider text-secondary">Next task</p>
          <div className="flex items-start gap-3">
            <Icon
              name={TASK_TYPE_ICON[nextTaskObj.type] || "check_circle"}
              size={20}
              className="mt-0.5 shrink-0 text-primary"
            />
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">
                {nextTaskObj.title || nextTaskObj.skill || "Untitled task"}
              </p>
              {nextTaskObj.skill && (
                <p className="text-xs text-secondary">Skill: {nextTaskObj.skill}</p>
              )}
              {nextTaskObj.description && (
                <p className="mt-1 text-sm text-secondary line-clamp-2">{nextTaskObj.description}</p>
              )}
            </div>
          </div>

          {firstResource && (
            <a
              href={firstResource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm transition-colors hover:bg-surface-container-low"
            >
              <span className="flex items-center gap-2 text-on-surface">
                <Icon name={RESOURCE_ICON[firstResource.type] || "menu_book"} size={16} className="text-primary" />
                <span className="truncate">{firstResource.title}</span>
              </span>
              {firstResource.duration && (
                <span className="shrink-0 text-xs text-secondary">{firstResource.duration}</span>
              )}
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <Icon name="celebration" size={18} filled />
            All tasks in this week are complete
          </p>
        </div>
      )}

      <Link
        href="/roadmap"
        className="mt-4 inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline"
      >
        Continue learning
        <Icon name="arrow_forward" size={16} />
      </Link>
    </div>
  );
}
