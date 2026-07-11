"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import ConfidenceBadge from "@/components/skill-gap/ConfidenceBadge";

/**
 * The page's primary content — top 5 priority_learn as a ranked list, not
 * equal-weight cards. Secondary actions (practice, job matches) are quiet
 * text links underneath, never competing with the hero's primary CTA.
 */
export default function PriorityLearnList({ gap }) {
  const top = (gap.priority_learn || []).slice(0, 5);
  const maxScore = Math.max(1, ...top.map((p) => p.priority_score ?? 0));

  return (
    <section className="mb-16 mask-reveal">
      <h2 className="text-headline-md text-on-surface">Learn next for {gap.target_role}</h2>
      <p className="mt-1 text-body-md text-secondary">Ranked by Nepal market demand and verified gaps.</p>

      {top.length === 0 ? (
        <p className="mt-6 text-body-md text-secondary">
          No priority gaps found — your claimed skills already cover the market. Great work.
        </p>
      ) : (
        <ol className="mt-8 space-y-1">
          {top.map((p, i) => (
            <li
              key={p.skill}
              className="stagger-fade-in flex items-start gap-4 border-b border-outline-variant/50 py-4 last:border-0"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-sm font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-label-md font-bold text-on-surface">{p.skill}</h3>
                  {p.confidence && <ConfidenceBadge level={p.confidence} />}
                </div>
                <p className="mt-1 text-body-md text-secondary">{p.reason}</p>
                <div className="mt-2.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, ((p.priority_score ?? 0) / maxScore) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {top.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href={`/practice?skills=${encodeURIComponent(top.slice(0, 3).map((p) => p.skill).join(","))}`}
            className="flex items-center gap-1.5 text-label-md font-bold text-primary hover:underline"
          >
            <Icon name="fitness_center" size={16} />
            Practice top 3
          </Link>
          <Link
            href="/jobs"
            className="flex items-center gap-1.5 text-label-md font-bold text-primary hover:underline"
          >
            <Icon name="work" size={16} />
            View job matches
          </Link>
        </div>
      )}
    </section>
  );
}
