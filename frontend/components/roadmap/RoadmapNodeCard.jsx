"use client";

import Icon from "@/components/ui/Icon";
import { NODE_STATUS } from "@/lib/roadmapCanvasModel";
import { STATUS_LABEL } from "./RoadmapProgressHeader";

const STATUS_STYLES = {
  [NODE_STATUS.COMPLETED]: {
    card: "border-emerald-300/80 bg-emerald-50/50 dark:bg-emerald-950/20",
    icon: "bg-emerald-500 text-white",
    badge: "bg-emerald-100 text-emerald-800",
    ring: "",
  },
  [NODE_STATUS.ACTIVE]: {
    card: "border-primary bg-primary/[0.04] roadmap-node-active",
    icon: "bg-primary text-on-primary",
    badge: "bg-primary text-on-primary",
    ring: "ring-2 ring-primary/30",
  },
  [NODE_STATUS.UPCOMING]: {
    card: "border-outline-variant/70 bg-surface-container-lowest",
    icon: "bg-surface-container-high text-on-surface-variant",
    badge: "bg-surface-container-high text-secondary",
    ring: "",
  },
  [NODE_STATUS.LOCKED]: {
    card: "border-outline-variant/40 bg-surface-container-low opacity-60",
    icon: "bg-surface-container text-secondary",
    badge: "bg-surface-container text-secondary",
    ring: "",
  },
};

export default function RoadmapNodeCard({
  node,
  index = 0,
  selected = false,
  onSelect,
  onKeyDown,
  cardRef,
  reducedMotion = false,
}) {
  const styles = STATUS_STYLES[node.status] || STATUS_STYLES[NODE_STATUS.UPCOMING];
  const isCompleted = node.status === NODE_STATUS.COMPLETED || node.isCompleted;
  const isActive = node.status === NODE_STATUS.ACTIVE;
  const isLocked = node.status === NODE_STATUS.LOCKED;

  return (
    <button
      type="button"
      ref={cardRef}
      data-roadmap-card
      data-node-id={node.id}
      onClick={() => onSelect?.(node)}
      onKeyDown={onKeyDown}
      disabled={isLocked}
      aria-label={`${node.title}, ${STATUS_LABEL[node.status] || node.status}`}
      aria-current={isActive ? "step" : undefined}
      className={[
        "roadmap-node-card group relative flex w-[min(100%,280px)] flex-col rounded-2xl border p-4 text-left shadow-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        styles.card,
        styles.ring,
        selected ? "shadow-md ring-2 ring-primary/40" : "",
        isLocked ? "cursor-not-allowed" : "cursor-pointer",
        reducedMotion ? "" : "roadmap-node-enter",
      ].join(" ")}
      style={reducedMotion ? undefined : { animationDelay: `${Math.min(index, 12) * 60}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${styles.icon}`}
        >
          <Icon name={isCompleted ? "check_circle" : node.icon || "school"} size={22} filled={isCompleted} />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}>
          {STATUS_LABEL[node.status] || node.status}
        </span>
      </div>

      <h3
        className={`line-clamp-2 text-label-md font-bold leading-snug ${
          isCompleted ? "text-secondary line-through" : "text-on-surface"
        }`}
      >
        {node.title}
      </h3>

      {node.description && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-secondary">{node.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-secondary">
        {node.skill && (
          <span className="rounded-md bg-surface-container px-2 py-0.5 font-semibold uppercase tracking-wide">
            {node.skill}
          </span>
        )}
        {node.estimatedMinutes && <span>{node.estimatedMinutes}m</span>}
        {node.xp != null && (
          <span className="font-semibold text-primary">+{node.xp} XP</span>
        )}
      </div>

      {node.autoCompleted && (
        <span className="mt-2 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
          From profile
        </span>
      )}

      {isActive && !reducedMotion && <span className="roadmap-node-pulse pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />}
    </button>
  );
}
