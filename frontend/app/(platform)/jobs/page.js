"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { matchJobs, getJobMatches, getJobCorpusStatus } from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache, invalidateCache } from "@/lib/resource-cache";
import JobMatchCard from "@/components/dashboard/JobMatchCard";
import { saveJob, loadTrackedJobs, isJobSaved, subscribeTrackedJobs } from "@/lib/applicationsStore";

export default function JobsPage() {
  const { profileId, profile } = useProfile();
  const cacheKey = `jobs:${profileId}`;
  const initial = readCache(cacheKey);

  const [data, setData] = useState(initial.data);
  const [corpus, setCorpus] = useState(null);
  const [loading, setLoading] = useState(!initial.data);
  const [refreshing, setRefreshing] = useState(false);
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

  const load = async ({ force = false } = {}) => {
    if (!profileId) return;
    if (!data) setLoading(true);
    else if (force) setRefreshing(true);
    setError(null);
    try {
      const fetchJobs = async () => {
        if (force) {
          invalidateCache(cacheKey);
          return matchJobs(profileId);
        }
        try {
          return await getJobMatches(profileId);
        } catch (err) {
          if (err?.status === 404) return matchJobs(profileId);
          throw err;
        }
      };
      const [result, status] = await Promise.all([
        loadWithCache(cacheKey, fetchJobs, CACHE_TTL.jobs),
        getJobCorpusStatus().catch(() => null),
      ]);
      setData(result);
      setCorpus(status);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  if (loading && !data) return <LoadingState label="Finding relevant job matches..." />;

  const jobs = data?.matches || [];

  return (
    <div className="min-h-screen p-12">
      <header className="mb-8 mask-reveal">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-display-lg text-on-surface">Job Matches</h1>
            <p className="mt-2 max-w-2xl text-body-lg text-secondary">
              Precision-ranked postings for{" "}
              <span className="font-bold text-on-surface">{profile?.target_role}</span> — scored
              across skills, role fit, seniority, domain, and location.
            </p>
          </div>
          <Link
            href="/jobs/lab"
            className="flex shrink-0 items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-label-md font-bold text-secondary hover:bg-surface-container-low"
          >
            <Icon name="science" size={18} />
            Recommendation Lab
          </Link>
        </div>
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
