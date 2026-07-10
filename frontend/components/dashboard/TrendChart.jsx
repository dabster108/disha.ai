"use client";

import { memo } from "react";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * CSS bar chart for score trends. `points` = [{ label, score, at? }].
 * `max` defaults to 100 for readiness %, pass 10 for interview/practice.
 */
function TrendChartBase({
  title,
  points = [],
  max = 100,
  unit = "%",
  delta = null,
  emptyMessage = "No data yet",
  colorClass = "bg-primary",
  mutedColorClass = "bg-primary/30",
}) {
  const hasData = points.length > 0;
  const peak = hasData ? Math.max(...points.map((p) => p.score), 1) : 1;

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
          {title}
        </span>
        {delta != null && (
          <span
            className={cn(
              "flex items-center gap-1 text-label-sm font-bold",
              delta >= 0 ? "text-green-600" : "text-error"
            )}
          >
            <Icon name={delta >= 0 ? "trending_up" : "trending_down"} size={16} />
            {delta >= 0 ? "+" : ""}
            {typeof delta === "number" && unit === "%" ? Math.round(delta) : delta.toFixed(1)}
            {unit}
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div className="flex h-28 items-end gap-1.5 sm:gap-2">
            {points.map((p, i) => {
              const h = Math.max(8, (p.score / max) * 100);
              const isLast = i === points.length - 1;
              return (
                <div key={`${p.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-on-surface">
                    {typeof p.score === "number" && unit === "/10"
                      ? p.score.toFixed(1)
                      : Math.round(p.score)}
                  </span>
                  <div
                    title={`${p.label}: ${p.score}${unit}`}
                    className={cn(
                      "w-full rounded-t transition-all",
                      isLast ? colorClass : mutedColorClass
                    )}
                    style={{ height: `${h}%` }}
                  />
                  <span className="truncate text-[9px] text-secondary">{p.label}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-secondary">
            {points.length} data point{points.length !== 1 ? "s" : ""}
            {peak > 0 && unit !== "%" ? ` · peak ${peak.toFixed(1)}${unit}` : ""}
          </p>
        </>
      ) : (
        <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 text-center">
          <Icon name="bar_chart" className="mb-2 text-2xl text-secondary/50" />
          <p className="text-sm text-secondary">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

export default memo(TrendChartBase);
