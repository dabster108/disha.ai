"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import ConfidenceBadge from "@/components/skill-gap/ConfidenceBadge";

const ACCURACY_STYLE = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-primary/10 text-primary",
  Low: "bg-tertiary-fixed text-on-tertiary-fixed",
};

const SIGNAL_ICONS = {
  cv_claimed: "description",
  market: "work",
  interview: "record_voice_over",
  practice: "sports_esports",
};

/**
 * Refactored ValidationPanel — collapsed by default to a one-line summary so
 * the 4-signal detail (previously 4 equal hero-competing cards) never
 * outweighs Learn Next / Your Standing. Expands into a compact list.
 */
export default function EvidencePanel({ evidence }) {
  const [expanded, setExpanded] = useState(false);
  if (!evidence) return null;

  const { signals = {}, accuracy_level, confidence_legend = {}, checklist = [] } = evidence;
  const signalEntries = Object.entries(signals);
  const presentCount = signalEntries.filter(([, s]) => s.present).length;
  const accuracyStyle = ACCURACY_STYLE[accuracy_level] || ACCURACY_STYLE.Low;

  return (
    <section className="mb-16 mask-reveal">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full min-h-11 items-center justify-between gap-4 rounded-xl border border-outline-variant bg-white px-5 py-4 text-left transition-colors hover:bg-surface-container-low"
      >
        <span className="flex items-center gap-3">
          <Icon name="verified" size={20} className="text-primary" />
          <span className="text-label-md font-bold text-on-surface">
            Evidence:{" "}
            <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold ${accuracyStyle}`}>
              {accuracy_level}
            </span>{" "}
            <span className="font-normal text-secondary">· {presentCount}/{signalEntries.length} signals</span>
          </span>
        </span>
        <Icon
          name="expand_more"
          className={`shrink-0 text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`accordion-content ${expanded ? "expanded" : ""}`}>
        <div>
          <div className="mt-5 grid grid-cols-1 gap-5 border-t border-outline-variant/50 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {signalEntries.map(([key, s]) => (
              <div key={key} className="flex items-start gap-3">
                <Icon
                  name={SIGNAL_ICONS[key] || "check_circle"}
                  size={20}
                  className={s.present ? "text-primary" : "text-outline"}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
                    {s.label}
                    {s.present ? (
                      <Icon name="check_circle" size={14} className="text-green-600" />
                    ) : (
                      <Icon name="radio_button_unchecked" size={14} className="text-outline" />
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-secondary">
                    {key === "cv_claimed" && (s.present ? `${s.count} skills on profile` : "No skills on profile yet")}
                    {key === "market" && `${s.jobs_analyzed} postings · ${s.skills_in_demand} skills in demand`}
                    {key === "interview" && (s.present ? `Score ${s.overall_score ?? "—"}/10 · ${s.verified_skills} verified` : "Not completed")}
                    {key === "practice" && (s.present ? `${s.verified_skills} skills verified` : "Not completed")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {Object.keys(confidence_legend).length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-outline-variant/50 pt-5 text-xs text-secondary">
              {Object.entries(confidence_legend).map(([level, desc]) => (
                <span key={level} className="flex items-center gap-2">
                  <ConfidenceBadge level={level} />
                  {desc}
                </span>
              ))}
            </div>
          )}

          {checklist.some((c) => !c.done) && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="mb-3 text-label-md font-bold text-primary">Raise your accuracy</p>
              <div className="space-y-2.5">
                {checklist.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-body-md text-on-surface">
                      <Icon
                        name={c.done ? "check_circle" : "radio_button_unchecked"}
                        size={18}
                        className={c.done ? "text-green-600" : "text-secondary"}
                      />
                      <span className={c.done ? "text-secondary line-through" : ""}>{c.label}</span>
                    </span>
                    {!c.done && (
                      <Link href={c.href} className="shrink-0 text-label-md font-bold text-primary hover:underline">
                        Start
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
