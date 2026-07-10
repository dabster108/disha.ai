"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getLeaderboard } from "@/lib/api";

export default function AdminLeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getLeaderboard(null, 200)
      .then((res) => setEntries(res.entries || []))
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading leaderboard..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Leaderboard (Admin View)</h1>
        <p className="mt-1 text-body-md text-secondary">{entries.length} ranked profiles.</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Interview</th>
              <th className="px-5 py-3">Practice</th>
              <th className="px-5 py-3">Gap</th>
              <th className="px-5 py-3">Roadmap</th>
              <th className="px-5 py-3">Composite</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.profile_id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                <td className="px-5 py-3 font-bold text-on-surface">#{i + 1}</td>
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${e.profile_id}`} className="font-semibold text-on-surface hover:text-primary">
                    {e.full_name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-secondary">{e.target_role}</td>
                <td className="px-5 py-3">{e.category_scores?.interview ?? 0}</td>
                <td className="px-5 py-3">{e.category_scores?.practice ?? 0}</td>
                <td className="px-5 py-3">{e.category_scores?.skill_gap ?? 0}%</td>
                <td className="px-5 py-3">{e.category_scores?.roadmap ?? 0}%</td>
                <td className="px-5 py-3 font-bold text-primary">{e.composite_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
