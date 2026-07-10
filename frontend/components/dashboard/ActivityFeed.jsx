"use client";

import { memo } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const TYPE_STYLES = {
  gap: "bg-primary/10 text-primary",
  interview: "bg-tertiary/10 text-tertiary",
  practice: "bg-secondary/10 text-secondary",
};

function ActivityFeedBase({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <span className="mb-4 block text-label-sm font-semibold uppercase tracking-wider text-secondary">
          Recent Activity
        </span>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest py-10 text-center">
          <Icon name="history" className="mb-2 text-3xl text-secondary/50" />
          <p className="text-sm text-secondary">No activity yet — start with a skill gap analysis.</p>
          <Link href="/skill-gap" className="mt-3 text-label-sm font-bold text-primary hover:underline">
            Run skill gap →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">
          Recent Activity
        </span>
        <span className="text-xs text-secondary">{items.length} events</span>
      </div>
      <ul className="space-y-0">
        {items.map((item, i) => (
          <li key={`${item.type}-${item.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-outline-variant/60" />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                TYPE_STYLES[item.type] || "bg-surface-container-low text-secondary"
              )}
            >
              <Icon name={item.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-label-md font-bold text-on-surface">{item.title}</p>
                <time className="text-[10px] text-secondary">
                  {new Date(item.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              <p className="mt-0.5 truncate text-sm text-secondary">{item.detail}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="mt-1 inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
                >
                  View
                  <Icon name="arrow_forward" size={12} />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(ActivityFeedBase);
