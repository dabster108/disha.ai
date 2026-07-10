"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminLearning } from "@/lib/adminApi";

export default function AdminLearningPage() {
  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getAdminLearning({ limit: 100 }).then(setCurricula).catch(setError).finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading curricula..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Learning Curricula</h1>
        <p className="mt-1 text-body-md text-secondary">{curricula.length} generated curricula across all students.</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3">Sections</th>
              <th className="px-5 py-3">Modules</th>
              <th className="px-5 py-3">Progress</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Generated</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {curricula.map((c) => (
              <tr key={c.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                <td className="px-5 py-3 font-semibold text-on-surface">{c.full_name || "Anonymous"}</td>
                <td className="px-5 py-3 text-secondary">{c.section_count}</td>
                <td className="px-5 py-3 text-secondary">{c.module_count}</td>
                <td className="px-5 py-3 font-bold text-on-surface">
                  {c.completed_modules}/{c.module_count}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-secondary">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/users/${c.profile_id}`} className="font-bold text-primary hover:underline">
                    View profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {curricula.length === 0 && <p className="p-8 text-center text-sm text-secondary">No curricula generated yet.</p>}
      </div>
    </div>
  );
}
