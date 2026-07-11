"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/ui/Icon";
import { resolveResourceConsume } from "@/lib/resourceConsume";
import { formatMinutes } from "@/lib/roadmapCanvasModel";
import { STATUS_LABEL } from "./RoadmapProgressHeader";

const RESOURCE_ICON = {
  video: "play_circle",
  article: "article",
  docs: "menu_book",
  course: "school",
  practice: "fitness_center",
};

export default function RoadmapDetailPanel({
  node,
  open,
  onClose,
  onToggleComplete,
  onOpenResource,
  isToggling = false,
  isResourceDone,
  reducedMotion = false,
}) {
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !node) return null;

  const resources = node.resources || [];
  const completed = node.isCompleted;
  const legacyResourceGated = node.meta?.legacy && resources.length > 0 && !completed;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        data-roadmap-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-panel-title"
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-outline-variant/60 bg-surface-container-lowest shadow-2xl",
          reducedMotion ? "" : "roadmap-panel-enter",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/50 p-5">
          <div className="min-w-0">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">{node.sectionTitle}</p>
            <h2 id="roadmap-panel-title" className="mt-1 text-headline-sm font-bold text-on-surface">
              {node.title}
            </h2>
            <p className="mt-1 text-sm text-secondary">{STATUS_LABEL[node.status]}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 text-secondary transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="mb-6">
            <h3 className="mb-2 text-label-md font-bold text-on-surface">Overview</h3>
            <p className="text-body-md text-secondary">
              {node.description || `Build practical ${node.skill || "skills"} aligned with your career path.`}
            </p>
            {node.autoCompleted && (
              <p className="mt-2 text-sm font-semibold text-primary">Auto-checked: {node.autoCompleted.reason}</p>
            )}
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3">
            <MetaTile icon="schedule" label="Est. time" value={formatMinutes(node.estimatedMinutes)} />
            <MetaTile icon="stars" label="Reward" value={`+${node.xp || 0} XP`} />
            <MetaTile icon="school" label="Skill" value={node.skill || "—"} />
            <MetaTile icon="category" label="Type" value={node.type || "lesson"} />
          </section>

          {node.skill && (
            <section className="mb-6">
              <h3 className="mb-2 text-label-md font-bold text-on-surface">Skills learned</h3>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {node.skill}
              </span>
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-3 text-label-md font-bold text-on-surface">Resources</h3>
            {resources.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-secondary">
                No resources attached yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {resources.map((res, ri) => {
                  const resolved = resolveResourceConsume(res);
                  const openable = resolved.consume === "embed" || resolved.consume === "markdown";
                  const done = isResourceDone?.(ri) ?? false;
                  return (
                    <li key={`${res.url}-${ri}`}>
                      <button
                        type="button"
                        disabled={!openable}
                        onClick={() => openable && onOpenResource?.(resolved, ri)}
                        className={[
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                          openable ? "border-outline-variant/70 hover:border-primary/40 hover:bg-surface-container-low" : "cursor-not-allowed opacity-50",
                          done ? "border-emerald-300/70 bg-emerald-50/40" : "bg-surface-container-lowest",
                        ].join(" ")}
                      >
                        <Icon
                          name={RESOURCE_ICON[res.type] || "link"}
                          size={20}
                          className={done ? "text-emerald-600" : "text-primary"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${done ? "line-through text-secondary" : "text-on-surface"}`}>
                            {res.title}
                          </p>
                          <p className="truncate text-xs text-secondary">
                            {res.provider}
                            {res.duration ? ` · ${res.duration}` : ""}
                          </p>
                        </div>
                        {done && <Icon name="check_circle" size={18} className="text-emerald-600" filled />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-6 rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <h3 className="mb-1 text-label-md font-bold text-on-surface">Practice & projects</h3>
            <p className="text-sm text-secondary">
              Apply {node.skill || "this skill"} in a small exercise or project after reviewing the resources above.
            </p>
          </section>
        </div>

        <div className="border-t border-outline-variant/50 p-5">
          <button
            type="button"
            onClick={() => onToggleComplete?.(!completed)}
            disabled={isToggling || legacyResourceGated}
            title={legacyResourceGated ? "Complete all resources first" : undefined}
            className={[
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-label-md font-bold transition-all duration-200",
              completed
                ? "border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container"
                : "bg-primary text-on-primary hover:bg-primary-container",
            ].join(" ")}
          >
            <Icon name={isToggling ? "hourglass_empty" : completed ? "undo" : "check_circle"} size={20} />
            {isToggling ? "Saving..." : completed ? "Mark incomplete" : "Mark complete"}
          </button>
        </div>
      </aside>
    </>
  );
}

function MetaTile({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-secondary">
        <Icon name={icon} size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
