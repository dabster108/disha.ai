"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getMasterRoadmaps } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const CACHE_KEY = "admin:master-roadmaps";

export default function AdminMasterRoadmapsPage() {
  const initial = readCache(CACHE_KEY);
  const [items, setItems] = useState(initial.data || []);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  const load = () => {
    if (!items.length) setLoading(true);
    setError(null);
    loadWithCache(CACHE_KEY, getMasterRoadmaps, CACHE_TTL.adminCatalog)
      .then(setItems)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !items.length) return <LoadingState label="Loading master roadmaps..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-on-surface">Master Roadmaps</h1>
          <p className="mt-1 text-body-md text-secondary">
            Curated role curricula — students get these when they generate a roadmap.
          </p>
        </div>
        <Link
          href="/admin/master-roadmaps/new"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-90"
        >
          + Add roadmap
        </Link>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
            <tr>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Key</th>
              <th className="px-5 py-3">Version</th>
              <th className="px-5 py-3">Phases</th>
              <th className="px-5 py-3">Nodes</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.role_key}
                className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-lowest"
              >
                <td className="px-5 py-3 font-semibold text-on-surface">{row.role}</td>
                <td className="px-5 py-3 font-mono text-xs text-secondary">{row.role_key}</td>
                <td className="px-5 py-3 text-secondary">{row.roadmap_version}</td>
                <td className="px-5 py-3 text-secondary">{row.phase_count}</td>
                <td className="px-5 py-3 text-secondary">{row.node_count}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      row.source === "json" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {row.source === "json" ? "json" : "fallback"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/master-roadmaps/${row.role_key}`}
                    className="font-bold text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
