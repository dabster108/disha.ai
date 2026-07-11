"use client";

import Icon from "@/components/ui/Icon";
import ReadinessGauge from "@/components/skill-gap/ReadinessGauge";
import { readinessStatus, accuracyTip } from "@/components/skill-gap/readinessCopy";

const ACCURACY_STYLE = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-primary/10 text-primary",
  Low: "bg-tertiary-fixed text-on-tertiary-fixed",
};

/**
 * First viewport: everything a student needs before scrolling — readiness,
 * accuracy honesty, one primary action, and a one-line nudge toward the top
 * priority skill. Evidence, skills-standing, and role-fit all live below.
 */
export default function SkillGapHero({
  gap,
  onGenerateRoadmap,
  generatingRoadmap,
  onRun,
  running,
}) {
  const accuracyLevel = gap.evidence?.accuracy_level;
  const tip = accuracyTip(gap.evidence);
  const topPriority = gap.priority_learn?.[0];

  return (
    <header className="mb-16 mask-reveal">
      <p className="mb-6 text-label-md text-secondary">
        <span className="font-semibold text-on-surface">{gap.target_role}</span>
        {" · Nepal · "}
        {gap.jobs_analyzed} postings analyzed
      </p>

      <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-12 md:text-left">
        <ReadinessGauge score={gap.readiness_score} size={168} stroke={11} />

        <div className="flex flex-1 flex-col items-center md:items-start">
          <h1 className="text-headline-lg font-semibold text-on-surface">
            {readinessStatus(gap.readiness_score)}
          </h1>
          <p className="mt-1 max-w-md text-body-md text-secondary">
            Skill gap for {gap.target_role}, based on real Nepal job postings.
          </p>

          {accuracyLevel && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className={`rounded-full px-3 py-1 text-label-sm font-bold uppercase tracking-wide ${ACCURACY_STYLE[accuracyLevel] || ACCURACY_STYLE.Low}`}>
                {accuracyLevel} accuracy
              </span>
              {tip && <span className="text-sm text-secondary">{tip}</span>}
            </div>
          )}

          <div className="mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row md:items-start">
            <button
              type="button"
              onClick={onGenerateRoadmap}
              disabled={generatingRoadmap}
              className="min-h-11 w-full rounded-xl bg-primary px-7 py-3 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-60 sm:w-auto"
            >
              {generatingRoadmap ? "Generating..." : "Generate Roadmap"}
            </button>
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="min-h-11 w-full rounded-xl px-5 py-3 text-label-md font-bold text-secondary transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-60 sm:w-auto"
            >
              {running ? "Re-running..." : "Re-run analysis"}
            </button>
          </div>

          {topPriority && (
            <p className="mt-5 flex items-center gap-1.5 text-sm text-secondary">
              <Icon name="arrow_forward" size={16} className="text-primary" />
              Start with <span className="font-bold text-on-surface">{topPriority.skill}</span>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
