"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getJobCorpusStatus } from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const CACHE_KEY = "admin:jobs-corpus";

export default function AdminJobsPage() {
  const initial = readCache(CACHE_KEY);
  const [status, setStatus] = useState(initial.data);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!status) setLoading(true);
    setError(null);
    loadWithCache(CACHE_KEY, getJobCorpusStatus, CACHE_TTL.admin)
      .then(setStatus)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !status) return <LoadingState label="Loading corpus status..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Jobs Corpus</h1>
        <p className="mt-1 text-body-md text-secondary">Live Nepal job data backing skill gap and job matching.</p>
      </header>

      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`flex h-3 w-3 rounded-full ${status.ready ? "bg-green-500" : "bg-red-500"}`}
          />
          <p className="text-headline-sm font-bold text-on-surface">
            {status.ready ? "Corpus ready" : "Corpus not ready"}
          </p>
        </div>
        <p className="mb-6 text-sm text-secondary">{status.message}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-outline-variant/60 p-4 text-center">
            <p className="text-headline-md font-bold text-on-surface">{status.jobs_file_count}</p>
            <p className="text-xs uppercase text-secondary">jobs.json entries</p>
          </div>
          <div className="rounded-xl border border-outline-variant/60 p-4 text-center">
            <p className="text-headline-md font-bold text-on-surface">{status.chroma_count}</p>
            <p className="text-xs uppercase text-secondary">Chroma vectors</p>
          </div>
        </div>
        {status.jobs_file_count !== status.chroma_count && (
          <p className="mt-4 flex items-center gap-2 text-sm text-tertiary">
            <Icon name="warning" size={16} />
            Counts don&apos;t match — re-run <code>python -m app.rag.ingest --reset</code>.
          </p>
        )}
      </div>
    </div>
  );
}
