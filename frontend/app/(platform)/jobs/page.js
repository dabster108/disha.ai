"use client";

import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { matchJobs, getJobCorpusStatus } from "@/lib/api";
import JobMatchCard from "@/components/dashboard/JobMatchCard";
import { saveJob, loadTrackedJobs, isJobSaved, subscribeTrackedJobs } from "@/lib/applicationsStore";

export default function JobsPage() {
  const { profileId, profile } = useProfile();
  const [data, setData] = useState(null);
  const [corpus, setCorpus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  const refreshTracked = useCallback(() => {
    setSavedIds(new Set(loadTrackedJobs().map((j) => j.id)));
  }, []);

  useEffect(() => {
    refreshTracked();
    return subscribeTrackedJobs(refreshTracked);
  }, [refreshTracked]);

  const handleSave = (job) => saveJob(job);

  const load = async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [result, status] = await Promise.all([
        matchJobs(profileId),
        getJobCorpusStatus().catch(() => null),
      ]);
      setData(result);
      setCorpus(status);
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
  const strongMatches = jobs.filter((j) => !j.relaxed_match);
  const relaxedOnly = jobs.length > 0 && strongMatches.length === 0;

  return (
    <div className="min-h-screen p-12">
      <header className="mb-8 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Job Matches</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Precision-ranked postings for{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span> — scored across
          skills, role fit, seniority, domain, and location.
        </p>
        {jobs.length > 0 && (
          <p className="mt-3 text-label-md text-secondary">
            Showing <span className="font-bold text-on-surface">{jobs.length}</span>{" "}
            {jobs.length === 1 ? "posting" : "postings"}
            {data?.jobs_analyzed ? ` ranked from ${data.jobs_analyzed} analyzed` : ""}.
          </p>
        )}
      </header>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      {relaxedOnly && (
        <div className="mb-8 rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 p-5 text-sm text-on-surface">
          <p className="flex items-center gap-2 font-semibold text-tertiary">
            <Icon name="info" size={18} />
            Related roles only
          </p>
          <p className="mt-2 text-secondary">
            No exact <span className="font-semibold text-on-surface">{profile?.target_role}</span>{" "}
            postings are in the current job index, so these are the closest adjacent roles (that&apos;s
            why scores are lower). Refresh the corpus for more direct matches, or broaden your target
            role.
          </p>
        </div>
      )}

      {corpus && !corpus.ready && (
        <div className="mb-8 rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 p-5 text-sm text-on-surface">
          <p className="font-semibold text-tertiary">Job index is empty</p>
          <p className="mt-2 text-secondary">{corpus.message}</p>
          <p className="mt-3 font-mono text-xs text-secondary">
            cd backend → uv run python scripts/seed_jobs.py → uv run python -m app.rag.ingest --reset
          </p>
        </div>
      )}

      {!error && jobs.length === 0 ? (
        <EmptyState
          icon="work_outline"
          title={corpus && !corpus.ready ? "No jobs indexed yet" : "No strong matches right now"}
          description={
            corpus && !corpus.ready
              ? "The Chroma job database has no postings. Seed demo jobs or run the scraper, then re-ingest."
              : `We indexed ${corpus?.chroma_count ?? "some"} jobs but none passed relevance thresholds for ${profile?.target_role}. Try broadening your skills or target role.`
          }
          actionLabel="Update Profile"
          actionHref="/onboarding"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {jobs.map((job) => {
            const id = job.id || `${job.title}|${job.company}`;
            return (
              <JobMatchCard
                key={id}
                job={job}
                onSave={handleSave}
                saved={savedIds.has(id)}
                showExplanation
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
