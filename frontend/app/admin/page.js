"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminStats } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const STATS_KEY = "admin:stats";

function StatTile({ icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} size={18} className="text-primary" />
        <span className="text-label-sm uppercase tracking-wider text-secondary">{label}</span>
      </div>
      <p className="text-headline-lg font-bold text-on-surface">{value}</p>
      {sub && <p className="mt-1 text-sm text-secondary">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const initial = readCache(STATS_KEY);
  const [stats, setStats] = useState(initial.data);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!stats) setLoading(true);
    setError(null);
    loadWithCache(STATS_KEY, getAdminStats, CACHE_TTL.admin)
      .then(setStats)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !stats) return <LoadingState label="Loading..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  const scrape = stats.latest_scrape;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-display-lg text-on-surface">Overview</h1>
        <p className="mt-1 text-body-md text-secondary">Platform at a glance.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon="group" label="Students" value={stats.profile_count} />
        <StatTile icon="work" label="Jobs indexed" value={stats.jobs_indexed} />
        <StatTile icon="today" label="Sessions today" value={stats.sessions_today} />
      </div>

      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline-sm font-bold text-on-surface">Latest scrape</h3>
          <Link href="/admin/scrape" className="text-sm font-medium text-primary hover:underline">
            Manage →
          </Link>
        </div>
        {scrape ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                scrape.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : scrape.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {scrape.status}
            </span>
            <span className="text-secondary">
              {scrape.jobs_count} jobs · {scrape.scrape_mode}
            </span>
            {scrape.finished_at && (
              <span className="text-secondary">{new Date(scrape.finished_at).toLocaleString()}</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-secondary">No scrape runs yet.</p>
        )}
      </div>
    </div>
  );
}
