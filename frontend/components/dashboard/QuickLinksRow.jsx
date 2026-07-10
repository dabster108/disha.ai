"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const STATUS_DOT = {
  complete: "bg-primary",
  in_progress: "bg-amber-500",
  not_started: "bg-outline-variant",
};

/**
 * Compact navigation cards for the dashboard footer. Each card shows the step's
 * completion state (dot), a one-line detail, and a resume link — so users can
 * jump back into any module without re-loading its full page.
 */
export default function QuickLinksRow({ steps = [] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {steps.map((step) => (
        <Link
          key={step.key}
          href={step.href}
          className="card-hover flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="rounded-lg bg-primary/5 p-1.5 text-primary">
              <Icon name={step.icon} size={20} />
            </span>
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[step.status])} />
          </div>
          <p className="text-sm font-bold text-on-surface leading-tight">{step.title}</p>
          {step.detail && <p className="text-xs text-secondary line-clamp-1">{step.detail}</p>}
          <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-primary">
            {step.status === "complete" ? "Review" : step.status === "in_progress" ? "Continue" : "Start"}
            <Icon name="arrow_forward" size={14} />
          </span>
        </Link>
      ))}
    </div>
  );
}
