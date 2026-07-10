"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminPractice } from "@/lib/adminApi";

export default function AdminPracticePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getAdminPractice({ limit: 100 }).then(setSessions).catch(setError).finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading practice sessions..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Practice Sessions</h1>
        <p className="mt-1 text-body-md text-secondary">{sessions.length} sessions across all students.</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3">Skills</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Verified strong</th>
              <th className="px-5 py-3">Verified weak</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest">
                <td className="px-5 py-3 font-semibold text-on-surface">{s.full_name || "Anonymous"}</td>
                <td className="px-5 py-3 text-secondary">{(s.skills_selected || []).join(", ")}</td>
                <td className="px-5 py-3 font-bold text-on-surface">{s.overall_score != null ? `${s.overall_score}/10` : "—"}</td>
                <td className="px-5 py-3 text-secondary">{(s.verified_strong_skills || []).join(", ") || "—"}</td>
                <td className="px-5 py-3 text-secondary">{(s.verified_weak_skills || []).join(", ") || "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      s.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-secondary">{new Date(s.started_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <p className="p-8 text-center text-sm text-secondary">No practice sessions yet.</p>}
      </div>
    </div>
  );
}
