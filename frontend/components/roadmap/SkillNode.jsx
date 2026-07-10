"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

const RESOURCE_ICON = {
  video: "play_circle",
  article: "article",
  docs: "menu_book",
  course: "school",
  practice: "fitness_center",
};

/**
 * A single skill-path node, roadmap.sh style:
 *  - completed  -> green tick (auto-completed nodes carry a "from your
 *    profile" badge so the student knows why it started checked)
 *  - active     -> the recommended next step, pulsing highlight
 *  - upcoming   -> neutral but still clickable — soft progression, nothing
 *    is locked behind prerequisites.
 */
export default function SkillNode({ node, autoCompleted, onToggle, isToggling, onResourceOpen }) {
  const [open, setOpen] = useState(false);
  const status = node.status || "upcoming";
  const isCompleted = status === "completed";
  const isActive = status === "active";
  const resources = node.resources || [];

  return (
    <div
      className={`relative z-10 rounded-2xl border bg-white transition-all ${
        isCompleted ? "border-green-300 bg-green-50/40" : isActive ? "pulse-border border-primary" : "border-outline-variant"
      }`}
    >
      <div className="flex w-full items-center gap-4 p-4 text-left">
        <button
          type="button"
          onClick={() => onToggle(node.id, !isCompleted)}
          disabled={isToggling}
          title={isCompleted ? "Mark as not done" : "Mark complete"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isCompleted
              ? "border-green-500 bg-green-500 text-white"
              : isActive
              ? "border-primary text-primary"
              : "border-outline-variant text-outline"
          }`}
        >
          <Icon name={isToggling ? "hourglass_empty" : isCompleted ? "check" : "circle"} size={isCompleted ? 18 : 10} filled={isCompleted} />
        </button>

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-label-md font-bold ${isCompleted ? "text-secondary line-through" : "text-on-surface"}`}>
                {node.title || node.skill}
              </p>
              {autoCompleted && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  From your profile
                </span>
              )}
              {isActive && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-on-primary">
                  Next up
                </span>
              )}
            </div>
            {node.description && <p className="mt-0.5 text-sm text-secondary line-clamp-1">{node.description}</p>}
          </div>
          <Icon name="expand_more" className={`shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant/40 p-4 pt-3">
          {node.description && <p className="mb-3 text-sm text-secondary">{node.description}</p>}
          {autoCompleted && <p className="mb-3 text-xs font-semibold text-primary">Auto-checked: {autoCompleted.reason}</p>}
          {resources.length > 0 && (
            <div className="space-y-2">
              {resources.map((res) => (
                <a
                  key={res.url}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onResourceOpen?.(res)}
                  className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container-low"
                >
                  <Icon name={RESOURCE_ICON[res.type] || "link"} size={18} className="shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{res.title}</p>
                    <p className="truncate text-xs text-secondary">
                      {res.provider}
                      {res.duration ? ` • ${res.duration}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      res.cost === "paid" ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {res.cost}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
