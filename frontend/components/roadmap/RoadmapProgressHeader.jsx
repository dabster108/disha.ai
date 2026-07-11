"use client";

import Icon from "@/components/ui/Icon";
import { formatMinutes } from "@/lib/roadmapCanvasModel";

const STATUS_LABEL = {
  completed: "Completed",
  active: "In progress",
  upcoming: "Up next",
  locked: "Locked",
};

export default function RoadmapProgressHeader({
  title,
  summary,
  stats,
  targetRole,
  knownFromProfile = 0,
  extraLabel,
}) {
  const { pct, completed, total, remaining, currentMilestone, estimatedRemainingLabel } = stats;

  return (
    <header className="roadmap-progress-header mb-8 space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-2 text-label-sm font-bold uppercase tracking-[0.2em] text-primary">
            {targetRole ? `${targetRole} Roadmap` : "Career Roadmap"}
          </p>
          <h1 className="text-display-lg text-on-surface">{title}</h1>
          {summary && <p className="mt-3 text-body-lg text-on-surface-variant">{summary}</p>}
          {knownFromProfile > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Icon name="verified" size={16} filled />
              {knownFromProfile} skill{knownFromProfile === 1 ? "" : "s"} credited from your profile
            </p>
          )}
          {extraLabel && <p className="mt-2 text-sm text-secondary">{extraLabel}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <StatCard label="Complete" value={`${pct}%`} accent />
          <StatCard label="Lessons done" value={`${completed}/${total}`} />
          <StatCard label="Remaining" value={String(remaining)} />
          <StatCard label="Est. left" value={estimatedRemainingLabel} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-on-surface">
            Current milestone: <span className="text-primary">{currentMilestone}</span>
          </span>
          <span className="text-secondary">{completed} of {total} completed</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Roadmap ${pct}% complete`}
        >
          <div
            className="roadmap-progress-fill h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </header>
  );
}

function StatCard({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">{label}</p>
      <p className={`mt-1 text-headline-sm font-bold ${accent ? "text-primary" : "text-on-surface"}`}>{value}</p>
    </div>
  );
}

export function RoadmapZoomControls({ zoom, onZoomIn, onZoomOut, onReset }) {
  return (
    <div
      className="absolute bottom-6 right-6 z-20 flex flex-col overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest/95 shadow-lg backdrop-blur-sm"
      data-roadmap-panel
      aria-label="Zoom controls"
    >
      <button
        type="button"
        onClick={onZoomIn}
        className="flex h-10 w-10 items-center justify-center text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-label="Zoom in"
      >
        <Icon name="add" size={20} />
      </button>
      <div className="border-y border-outline-variant/50 px-2 py-1 text-center text-xs font-semibold text-secondary">
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        onClick={onZoomOut}
        className="flex h-10 w-10 items-center justify-center text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-label="Zoom out"
      >
        <Icon name="remove" size={20} />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="flex h-10 w-10 items-center justify-center text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-label="Reset zoom"
      >
        <Icon name="center_focus_strong" size={18} />
      </button>
    </div>
  );
}

export { STATUS_LABEL, formatMinutes };
