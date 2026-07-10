"use client";

import { memo } from "react";
import Icon from "@/components/ui/Icon";

const SEGMENTS = [
  { key: "matched", label: "Matched", color: "bg-primary", text: "text-primary" },
  { key: "strong", label: "Verified strong", color: "bg-green-500", text: "text-green-700" },
  { key: "weak", label: "Needs work", color: "bg-amber-500", text: "text-amber-700" },
  { key: "missing", label: "Market gaps", color: "bg-error", text: "text-error" },
];

function SkillBreakdownChartBase({ breakdown, hasGap }) {
  if (!hasGap || !breakdown) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <span className="mb-4 block text-label-sm font-semibold uppercase tracking-wider text-secondary">
          Skill Inventory
        </span>
        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest text-center">
          <Icon name="pie_chart" className="mb-2 text-2xl text-secondary/50" />
          <p className="text-sm text-secondary">Run skill gap to see your skill breakdown.</p>
        </div>
      </div>
    );
  }

  const total = Math.max(
    breakdown.matched + breakdown.strong + breakdown.weak + breakdown.missing,
    1
  );

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <span className="mb-4 block text-label-sm font-semibold uppercase tracking-wider text-secondary">
        Skill Inventory
      </span>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-container-low">
        {SEGMENTS.map((seg) => {
          const val = breakdown[seg.key] || 0;
          if (!val) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} transition-all`}
              style={{ width: `${(val / total) * 100}%` }}
              title={`${seg.label}: ${val}`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.color}`} />
            <div className="min-w-0">
              <p className="text-xs text-secondary">{seg.label}</p>
              <p className={`text-label-md font-bold ${seg.text}`}>{breakdown[seg.key] || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {breakdown.priority > 0 && (
        <p className="mt-4 rounded-lg bg-primary/5 px-3 py-2 text-xs text-secondary">
          <span className="font-bold text-primary">{breakdown.priority}</span> skills prioritized for
          learning based on market demand.
        </p>
      )}
    </div>
  );
}

export default memo(SkillBreakdownChartBase);
