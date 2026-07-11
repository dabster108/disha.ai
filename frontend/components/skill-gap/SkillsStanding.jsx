"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import ConfidenceBadge from "@/components/skill-gap/ConfidenceBadge";

const MATCHED_PREVIEW_COUNT = 8;

/**
 * One cohesive "skills truth" section instead of four equal-weight stacked
 * cards — each sub-block only renders when it has content, so a student with
 * no interview/practice history doesn't see three "None yet" shells.
 */
export default function SkillsStanding({ gap }) {
  const matched = gap.matched_skills || [];
  const strong = gap.verified_strong_skills || [];
  const weak = gap.verified_weak_skills || [];
  const overclaimed = gap.overclaimed_skills || [];
  const [expandedMatched, setExpandedMatched] = useState(false);

  const hasAnything = matched.length + strong.length + weak.length + overclaimed.length > 0;
  const visibleMatched = expandedMatched ? matched : matched.slice(0, MATCHED_PREVIEW_COUNT);

  return (
    <section className="mb-16 mask-reveal">
      <h2 className="text-headline-md text-on-surface">Your standing</h2>

      {!hasAnything && (
        <p className="mt-4 text-body-md text-secondary">
          No verified skills yet — complete a mock interview or practice session to build your profile.
        </p>
      )}

      {matched.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-label-sm font-bold uppercase tracking-wider text-secondary">
            You match the market <span className="normal-case text-outline">· {matched.length}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleMatched.map((s) => (
              <span
                key={s.skill}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary"
                title={`${s.jobs_requiring} jobs require this${s.verified ? " • verified in testing" : ""}`}
              >
                {s.skill}
                {s.confidence && <ConfidenceBadge level={s.confidence} />}
              </span>
            ))}
            {matched.length > MATCHED_PREVIEW_COUNT && (
              <button
                type="button"
                onClick={() => setExpandedMatched((v) => !v)}
                className="rounded-full border border-outline-variant px-3 py-1.5 text-label-md font-bold text-secondary transition-colors hover:bg-surface-container-low"
              >
                {expandedMatched ? "Show less" : `+${matched.length - MATCHED_PREVIEW_COUNT} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {strong.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-label-sm font-bold uppercase tracking-wider text-secondary">
            Proven in testing <span className="normal-case text-outline">· {strong.length}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {strong.map((s) => (
              <span
                key={`${s.skill}-${s.source}`}
                className="rounded-full bg-green-100 px-3 py-1.5 text-label-md text-green-700"
                title={`Verified via ${s.source} (${s.score})`}
              >
                {s.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {weak.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-label-sm font-bold uppercase tracking-wider text-secondary">
            Needs work — proven weak <span className="normal-case text-outline">· {weak.length}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {weak.map((s) => (
              <span
                key={`${s.skill}-${s.source}`}
                className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed"
                title={`Verified via ${s.source} (${s.score})`}
              >
                {s.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {overclaimed.length > 0 && (
        <div className="mt-6 rounded-xl border border-error/20 bg-error-container/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="warning" size={18} className="text-error" />
            <p className="text-label-sm font-bold uppercase tracking-wider text-on-error-container">
              CV may overclaim
            </p>
          </div>
          <div className="space-y-2">
            {overclaimed.map((s) => (
              <p key={s.skill} className="text-body-md text-on-error-container">
                <span className="font-bold">{s.skill}</span> — {s.reason}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
