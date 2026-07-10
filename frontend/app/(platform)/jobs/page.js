"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { matchJobs } from "@/lib/api";

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
      <span className={`inline-block rounded-full px-4 py-1.5 text-headline-md font-bold ${tone}`}>
        {score}%
      </span>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-secondary">{label}</p>
    </div>
  );
}

export default function JobsPage() {
  const { profileId, profile } = useProfile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await matchJobs(profileId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  if (loading) return <LoadingState label="Finding relevant job matches..." />;

  const jobs = data?.matches || [];

  return (
    <div className="min-h-screen p-12">
      <header className="mb-8 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Job Matches</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Precision-ranked postings for{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span> — scored across
          skills, role fit, seniority, domain, and location.
        </p>
      </header>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      {!error && jobs.length === 0 ? (
        <EmptyState
          icon="work_outline"
          title="No strong matches right now"
          description="We only show jobs that pass strict relevance thresholds — no weak filler. Try broadening your skills, updating your target role, or checking back after the job corpus refreshes."
          actionLabel="Update Profile"
          actionHref="/onboarding"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {jobs.map((job) => (
            <div
              key={job.id || `${job.title}-${job.company}`}
              className="card-hover flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white transition-all"
            >
              <div className="flex-1 space-y-5 p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-headline-md font-bold">{job.title}</h3>
                    <p className="text-body-md text-secondary">{job.company}</p>
                    {job.location && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-secondary">
                        <Icon name="location_on" size={14} />
                        {job.location}
                      </p>
                    )}
                  </div>
                  <MatchBadge score={job.match_score} label={job.match_label} />
                </div>

                {(job.explanation?.positives?.length > 0 || job.explanation?.negatives?.length > 0) && (
                  <div className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
                    {job.explanation.positives?.map((item) => (
                      <p key={item} className="flex items-start gap-2 text-sm text-primary">
                        <Icon name="check_circle" size={16} className="mt-0.5 shrink-0" />
                        {item}
                      </p>
                    ))}
                    {job.explanation.negatives?.map((item) => (
                      <p key={item} className="flex items-start gap-2 text-sm text-secondary">
                        <Icon name="remove_circle_outline" size={16} className="mt-0.5 shrink-0" />
                        {item}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-outline-variant bg-surface-container-low/50 p-6">
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-container"
                >
                  View Posting
                  <Icon name="open_in_new" size={18} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
