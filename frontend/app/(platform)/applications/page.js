"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import {
  loadTrackedJobs,
  removeJob,
  setJobStatus,
  subscribeTrackedJobs,
  APPLICATION_STATUSES,
} from "@/lib/applicationsStore";

const STATUS_STYLE = {
  saved: "bg-surface-container text-secondary",
  viewed: "bg-primary/10 text-primary",
  applied: "bg-primary text-on-primary",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-tertiary-fixed text-on-tertiary-fixed",
};

const STATUS_ICONS = {
  saved: "bookmark_add",
  viewed: "visibility",
  applied: "send",
  interview: "groups",
  offer: "celebration",
  rejected: "cancel",
};

export default function ApplicationsPage() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(() => setJobs(loadTrackedJobs()), []);

  useEffect(() => {
    refresh();
    return subscribeTrackedJobs(refresh);
  }, [refresh]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    for (const j of jobs) map[j.status] = (map[j.status] || 0) + 1;
    return map;
  }, [jobs]);

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  if (jobs.length === 0) {
    return (
      <div className="min-h-screen p-12">
        <header className="mb-12">
          <h1 className="text-display-lg text-on-surface">Application Tracker</h1>
          <p className="mt-2 max-w-2xl text-body-lg text-secondary">
            Save jobs from your matches and track them from saved to offer.
          </p>
        </header>
        <EmptyState
          icon="bookmark_add"
          title="No tracked jobs yet"
          description="Save jobs from your Job Matches or Dashboard — they'll show up here so you can track status and follow-ups."
          actionLabel="Browse Job Matches"
          actionHref="/jobs"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-12">
      <header className="mb-8 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Application Tracker</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          {jobs.length} tracked {jobs.length === 1 ? "job" : "jobs"} · {counts.applied || 0} applied ·{" "}
          {counts.interview || 0} interviewing · {counts.offer || 0} offers
        </p>
      </header>

      {/* Status filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterPill label="All" count={jobs.length} active={filter === "all"} onClick={() => setFilter("all")} />
        {APPLICATION_STATUSES.map((s) => (
          <FilterPill
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            count={counts[s] || 0}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-body-md text-secondary">
          No jobs in this status.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="card-hover flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-5 transition-all md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-headline-md font-bold text-on-surface">{job.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      STATUS_STYLE[job.status]
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <p className="text-body-md text-secondary">{job.company}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-secondary">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <Icon name="location_on" size={14} />
                      {job.location}
                    </span>
                  )}
                  {job.match_score != null && (
                    <span className="flex items-center gap-1 font-bold text-primary">
                      <Icon name="analytics" size={14} />
                      {job.match_score}% match
                    </span>
                  )}
                  <span>Saved {new Date(job.savedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={job.status}
                  onChange={(e) => setJobStatus(job.id, e.target.value)}
                  className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
                  aria-label="Update application status"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                {job.source_url && (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant text-secondary hover:bg-surface-container-low"
                    aria-label="View posting"
                  >
                    <Icon name="open_in_new" size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => removeJob(job.id)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant text-secondary hover:bg-surface-container-low hover:text-error"
                  aria-label="Remove from tracker"
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-5">
        <p className="text-sm text-secondary">Find more roles to track.</p>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-label-md font-bold text-primary hover:underline"
        >
          Browse Job Matches
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    </div>
  );
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-label-md font-bold transition-colors ${
        active ? "bg-primary text-on-primary" : "bg-surface-container-low text-secondary hover:bg-surface-container"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? "bg-on-primary/20 text-on-primary" : "bg-surface-container text-secondary"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
