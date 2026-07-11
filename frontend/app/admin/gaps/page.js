"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminGaps } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const CACHE_KEY = "admin:gaps";

export default function AdminGapsPage() {
  const initial = readCache(CACHE_KEY);
  const [snapshots, setSnapshots] = useState(initial.data || []);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!snapshots.length) setLoading(true);
    setError(null);
    loadWithCache(CACHE_KEY, () => getAdminGaps({ limit: 100 }), CACHE_TTL.admin)
      .then(setSnapshots)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !snapshots.length) return <LoadingState label="Loading skill gap snapshots..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Skill Gap Snapshots</h1>
        <p className="mt-1 text-body-md text-secondary">{snapshots.length} runs across all students.</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Readiness</th>
              <th className="px-5 py-3">Jobs analyzed</th>
              <th className="px-5 py-3">Match ratio</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                <td className="px-5 py-3 font-semibold text-on-surface">{s.full_name || "Anonymous"}</td>
                <td className="px-5 py-3 text-secondary">{s.target_role}</td>
                <td className="px-5 py-3 font-bold text-on-surface">
                  {s.readiness_score != null ? `${Math.round(s.readiness_score)}%` : "—"}
                </td>
                <td className="px-5 py-3 text-secondary">{s.jobs_analyzed}</td>
                <td className="px-5 py-3 text-secondary">{Math.round((s.match_ratio || 0) * 100)}%</td>
                <td className="px-5 py-3 text-secondary">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/users/${s.profile_id}`} className="font-bold text-primary hover:underline">
                    View profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length === 0 && <p className="p-8 text-center text-sm text-secondary">No skill gap runs yet.</p>}
      </div>
    </div>
  );
}
