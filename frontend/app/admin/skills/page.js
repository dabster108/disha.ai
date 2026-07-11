"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getSkillsCatalog } from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

const CACHE_KEY = "admin:skills-catalog";

export default function AdminSkillsPage() {
  const initial = readCache(CACHE_KEY);
  const [catalog, setCatalog] = useState(initial.data);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWithCache(CACHE_KEY, getSkillsCatalog, CACHE_TTL.adminCatalog)
      .then(setCatalog)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !catalog) return <LoadingState label="Loading skills catalog..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={() => window.location.reload()} />;

  const roles = Object.entries(catalog.roles).filter(([name]) => name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-display-lg text-on-surface">Skills Catalog</h1>
          <p className="mt-1 text-body-md text-secondary">
            v{catalog.version} • {catalog.all_skills.length} skills · {Object.keys(catalog.roles).length} roles
          </p>
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter roles..."
          className="w-64 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </header>

      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <h3 className="mb-3 text-headline-sm font-bold text-on-surface">Global Skills</h3>
        <div className="flex flex-wrap gap-1.5">
          {catalog.global_skills.map((s) => (
            <span key={s} className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-medium text-secondary">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {roles.map(([role, skills]) => (
          <div key={role} className="rounded-2xl border border-outline-variant bg-white p-5">
            <p className="mb-2 text-label-md font-bold text-on-surface">
              {role} <span className="text-xs font-normal text-secondary">({skills.length})</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
