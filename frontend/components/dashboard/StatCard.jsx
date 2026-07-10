"use client";

import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * One dashboard stat card. Memoized — these never need to re-render once
 * their props are set, so the whole stats row is stable as other sections load.
 */
function StatCardBase({ icon, label, value, sub, progress, tone = "primary", trend }) {
  const toneClass = {
    primary: "bg-primary/5 text-primary",
    tertiary: "bg-tertiary/5 text-tertiary",
    secondary: "bg-secondary/5 text-secondary",
    accent: "bg-secondary-fixed text-on-secondary-fixed-variant",
  }[tone] || "bg-primary/5 text-primary";

  return (
    <div className="card-hover rounded-2xl border border-outline-variant bg-white p-6 transition-all">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("rounded-lg p-2", toneClass)}>
          <Icon name={icon} />
        </span>
        <span className="text-label-sm uppercase tracking-wider text-secondary">{label}</span>
        {trend != null && (
          <span
            className={cn(
              "ml-auto flex items-center gap-0.5 text-label-sm font-bold",
              trend >= 0 ? "text-green-600" : "text-error"
            )}
          >
            <Icon name={trend >= 0 ? "trending_up" : "trending_down"} size={16} />
            {trend >= 0 ? "+" : ""}
            {Math.round(trend)}
          </span>
        )}
      </div>
      <div className="text-headline-lg font-bold text-on-surface">{value}</div>
      {progress != null ? (
        <div className="mt-4 h-1.5 w-full rounded-full bg-surface-container-low">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : sub ? (
        <div className="mt-4 text-label-md text-secondary">{sub}</div>
      ) : null}
    </div>
  );
}

export default StatCardBase;
