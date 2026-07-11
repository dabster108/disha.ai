"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminRoadmaps } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const CACHE_KEY = "admin:roadmaps";

export default function AdminRoadmapsPage() {
  const initial = readCache(CACHE_KEY);
  const [roadmaps, setRoadmaps] = useState(initial.data || []);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!roadmaps.length) setLoading(true);
    setError(null);
    loadWithCache(CACHE_KEY, () => getAdminRoadmaps({ limit: 100 }), CACHE_TTL.admin)
      .then(setRoadmaps)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !roadmaps.length) return <LoadingState label="Loading roadmaps..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Student Roadmaps</h1>
        <p className="mt-1 text-body-md text-secondary">
          Per-student generated plans in the database. Edit role templates under{" "}
          <Link href="/admin/master-roadmaps" className="font-medium text-primary hover:underline">
            Master Roadmaps
          </Link>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3">Progress</th>
              <th className="px-5 py-3">Weeks</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {roadmaps.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                <td className="px-5 py-3 font-semibold text-on-surface">{r.full_name || "Anonymous"}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${r.progress_pct}%` }} />
                    </div>
                    <span className="font-bold text-on-surface">{r.progress_pct}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-secondary">{r.total_weeks ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-secondary">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/users/${r.profile_id}`} className="font-bold text-primary hover:underline">
                    View profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roadmaps.length === 0 && <p className="p-8 text-center text-sm text-secondary">No roadmaps yet.</p>}
      </div>
    </div>
  );
}
