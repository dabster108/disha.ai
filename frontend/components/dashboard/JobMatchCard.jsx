"use client";

import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

function MatchBadge({ score, label }) {
  const tone =
    score >= 90
      ? "bg-primary text-on-primary"
      : score >= 75
        ? "bg-primary/15 text-primary"
        : score >= 60
          ? "bg-surface-container-high text-on-surface"
          : "bg-tertiary-fixed text-on-tertiary-fixed";

  return (
    <div className="text-right">
      <span className={cn("inline-block rounded-full px-3 py-1 text-label-md font-bold", tone)}>{score}%</span>
      {label && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-secondary">{label}</p>}
    </div>
  );
}

/**
 * Shared job-match card — the single source of truth used by both the
 * Dashboard and the Jobs page so the two never disagree on presentation.
 *
 * `onSave` / `saved` wire into the Applications page (localStorage tracker).
 */
export default function JobMatchCard({ job, onSave, saved = false, showExplanation = false }) {
  const score = job.match_score ?? Math.round((job.similarity || 0) * 100);
  const matchedSkills = job.matched_skills || [];
  const missingSkills = job.missing_skills || [];

  return (
    <div className="card-hover flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-6 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="truncate text-headline-md font-bold text-on-surface">{job.title}</h4>
          <p className="text-body-md text-secondary">{job.company}</p>
          {job.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-secondary">
              <Icon name="location_on" size={14} />
              {job.location}
            </p>
          )}
        </div>
        <MatchBadge score={score} label={job.match_label} />
      </div>

      {matchedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matchedSkills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              {skill}
            </span>
          ))}
          {missingSkills.length > 0 && (
            <span className="rounded-full bg-tertiary-fixed/40 px-3 py-1 text-xs font-medium text-tertiary">
              +{missingSkills.length} to learn
            </span>
          )}
        </div>
      )}

      {showExplanation && (job.explanation?.positives?.length > 0 || job.explanation?.negatives?.length > 0) && (
        <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3">
          {job.explanation.positives?.slice(0, 2).map((item) => (
            <p key={item} className="flex items-start gap-2 text-xs text-primary">
              <Icon name="check_circle" size={14} className="mt-0.5 shrink-0" />
              {item}
            </p>
          ))}
          {job.explanation.negatives?.slice(0, 1).map((item) => (
            <p key={item} className="flex items-start gap-2 text-xs text-secondary">
              <Icon name="remove_circle_outline" size={14} className="mt-0.5 shrink-0" />
              {item}
            </p>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2">
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-label-md font-bold text-on-primary hover:bg-primary-container"
        >
          View
          <Icon name="open_in_new" size={16} />
        </a>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(job)}
            aria-label={saved ? "Saved" : "Save job"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
              saved
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-secondary hover:bg-surface-container-low"
            )}
          >
            <Icon name={saved ? "bookmark_added" : "bookmark_add"} size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
