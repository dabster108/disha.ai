"use client";

import { memo } from "react";
import Icon from "@/components/ui/Icon";
import TrendChart from "@/components/dashboard/TrendChart";
import SkillBreakdownChart from "@/components/dashboard/SkillBreakdownChart";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

function MetricTile({ icon, label, value, sub, tone = "primary" }) {
  const tones = {
    primary: "bg-primary/5 text-primary",
    tertiary: "bg-tertiary/5 text-tertiary",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-lg p-1.5 ${tones[tone] || tones.primary}`}>
          <Icon name={icon} size={18} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</span>
      </div>
      <p className="text-headline-sm font-bold text-on-surface">{value}</p>
      {sub && <p className="mt-1 text-xs text-secondary">{sub}</p>}
    </div>
  );
}

function AnalyticsSectionBase({
  readinessTrend,
  readinessDelta,
  interviewTrend,
  interviewDelta,
  practiceTrend,
  practiceDelta,
  matchRatioTrend,
  skillBreakdown,
  hasGap,
  activityFeed,
  summary,
  interviewAvg,
  practiceAvg,
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-headline-sm font-bold text-on-surface">Analytics</h3>
          <p className="text-body-md text-secondary">
            Track readiness, interview scores, practice results, and activity over time.
          </p>
        </div>
      </div>

      {/* Summary metric tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile
          icon="insights"
          label="Gap runs"
          value={summary.gapRuns}
          sub={summary.matchRatio != null ? `${summary.matchRatio}% job match` : "Not analyzed"}
        />
        <MetricTile
          icon="record_voice_over"
          label="Interviews"
          value={summary.interviewCount}
          sub={summary.interviewBest != null ? `Best ${summary.interviewBest}/10` : "None yet"}
          tone="tertiary"
        />
        <MetricTile
          icon="sports_esports"
          label="Practices"
          value={summary.practiceCount}
          sub={summary.practiceBest != null ? `Best ${summary.practiceBest}/10` : "None yet"}
          tone="green"
        />
        <MetricTile
          icon="psychology"
          label="Interview avg"
          value={interviewAvg != null ? `${interviewAvg.toFixed(1)}/10` : "—"}
          sub="Completed sessions"
          tone="tertiary"
        />
        <MetricTile
          icon="code"
          label="Practice avg"
          value={practiceAvg != null ? `${practiceAvg.toFixed(1)}/10` : "—"}
          sub="Completed sessions"
          tone="green"
        />
        <MetricTile
          icon="work"
          label="Jobs scanned"
          value={summary.jobsAnalyzed || "—"}
          sub="In last gap report"
          tone="amber"
        />
      </div>

      {/* Trend charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TrendChart
          title="Readiness trend"
          points={readinessTrend}
          max={100}
          unit="%"
          delta={readinessDelta}
          emptyMessage="Run skill gap more than once to see readiness over time."
        />
        <TrendChart
          title="Interview scores"
          points={interviewTrend}
          max={10}
          unit="/10"
          delta={interviewDelta}
          emptyMessage="Complete mock interviews to track your scores."
          colorClass="bg-tertiary"
          mutedColorClass="bg-tertiary/30"
        />
        <TrendChart
          title="Practice scores"
          points={practiceTrend}
          max={10}
          unit="/10"
          delta={practiceDelta}
          emptyMessage="Finish practice sessions to see improvement."
          colorClass="bg-green-500"
          mutedColorClass="bg-green-500/30"
        />
        <TrendChart
          title="Job match ratio"
          points={matchRatioTrend}
          max={100}
          unit="%"
          emptyMessage="Re-run skill gap to track market match changes."
          colorClass="bg-amber-500"
          mutedColorClass="bg-amber-500/30"
        />
      </div>

      {/* Breakdown + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkillBreakdownChart breakdown={skillBreakdown} hasGap={hasGap} />
        <ActivityFeed items={activityFeed} />
      </div>
    </section>
  );
}

export default memo(AnalyticsSectionBase);
