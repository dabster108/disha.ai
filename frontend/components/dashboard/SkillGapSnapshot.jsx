"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLE = {
  high: { cls: "bg-green-100 text-green-700", label: "High" },
  medium: { cls: "bg-primary/10 text-primary", label: "Medium" },
  low: { cls: "bg-tertiary-fixed text-on-tertiary-fixed", label: "Low" },
};

function ConfidenceBadge({ level }) {
  const style = CONFIDENCE_STYLE[level] || CONFIDENCE_STYLE.low;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.cls)}>
      {style.label}
    </span>
  );
}

/**
 * Mini skill-gap overview — reuses the same fields as the full Skill Gap page,
 * with no duplicated transformation logic (selectors come from dashboardData).
 */
export default function SkillGapSnapshot({
  strongSkills = [],
  prioritySkills = [],
  missingSkills = [],
  confidence = null,
  hasGap = false,
}) {
  if (!hasGap) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-white p-8 text-center">
        <Icon name="insights" className="mb-3 text-secondary" size={32} />
        <h3 className="mb-1 text-headline-sm font-bold text-on-surface">No skill gap analysis yet</h3>
        <p className="text-body-md text-secondary">
          Run your first analysis to see strengths, priorities, and missing market skills.
        </p>
        <Link
          href="/skill-gap"
          className="mt-4 inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary"
        >
          Run Skill Gap
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-headline-sm font-bold text-on-surface">Skill Gap Snapshot</h3>
        {confidence && <ConfidenceBadge level={confidence} />}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SnapshotColumn
          title="Strong Skills"
          icon="verified"
          tone="text-green-600"
          items={strongSkills.map((s) => ({
            label: s.skill,
            meta: s.verified ? `Verified · ${s.score ?? "—"}/10` : `${s.jobs_requiring ?? 0} jobs`,
          }))}
          emptyText="No verified strengths yet — take an interview to prove skills."
        />
        <SnapshotColumn
          title="Priority Skills"
          icon="priority_high"
          tone="text-primary"
          items={prioritySkills.map((s) => ({
            label: s.skill,
            meta: `Priority ${s.priority_score ?? "—"}`,
          }))}
          emptyText="No priority skills — you're well matched to the market."
        />
        <SnapshotColumn
          title="Missing in Market"
          icon="trending_down"
          tone="text-tertiary"
          items={missingSkills.map((s) => ({
            label: s.skill,
            meta: `In ${s.jobs_requiring ?? 0} postings`,
          }))}
          emptyText="No major missing skills detected."
        />
      </div>

      <Link
        href="/skill-gap"
        className="mt-5 inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline"
      >
        View full report
        <Icon name="arrow_forward" size={16} />
      </Link>
    </div>
  );
}

function SnapshotColumn({ title, icon, tone, items, emptyText }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} size={18} className={tone} />
        <h4 className="text-label-md font-bold uppercase tracking-wider text-secondary">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-secondary">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="rounded-lg bg-surface-container-low px-3 py-2">
              <p className="text-sm font-semibold text-on-surface">{item.label}</p>
              <p className="text-xs text-secondary">{item.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
