"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";

const CATEGORY_META = {
  interview: { label: "Interview", icon: "record_voice_over", max: 10, suffix: "/10" },
  practice: { label: "Practice", icon: "sports_esports", max: 10, suffix: "/10" },
  skill_gap: { label: "Skill Gap", icon: "insights", max: 100, suffix: "%" },
  roadmap: { label: "Roadmap", icon: "route", max: 100, suffix: "%" },
};

export default function ScoreRankSection({ yourRank, totalEntries, categoryScores }) {
  if (!categoryScores) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-headline-sm font-bold text-on-surface">Your Scores &amp; Rank</h3>
          {yourRank != null && totalEntries != null && (
            <p className="text-body-md text-secondary">
              Ranked <span className="font-bold text-primary">#{yourRank}</span> of {totalEntries}
            </p>
          )}
        </div>
        <Link href="/leaderboard" className="text-label-md font-bold text-primary hover:underline">
          Full leaderboard →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const value = categoryScores[key] || 0;
          const pct = Math.min(100, Math.round((value / meta.max) * 100));
          return (
            <div key={key} className="rounded-2xl border border-outline-variant bg-white p-5">
              <div className="mb-2 flex items-center gap-2">
                <Icon name={meta.icon} size={18} className="text-primary" />
                <span className="text-label-sm uppercase tracking-wider text-secondary">{meta.label}</span>
              </div>
              <div className="text-headline-md font-bold text-on-surface">
                {value}
                <span className="text-sm text-secondary">{meta.suffix}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
