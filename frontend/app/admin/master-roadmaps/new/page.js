"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import {
  createMasterRoadmap,
  getMasterRoadmapRegistry,
  scaffoldMasterRoadmap,
} from "@/lib/adminApi";
import { invalidateCache } from "@/lib/resource-cache";

function slugifyRoleKey(text) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminNewMasterRoadmapPage() {
  const router = useRouter();
  const [registry, setRegistry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleKey, setRoleKey] = useState("");
  const [role, setRole] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getMasterRoadmapRegistry()
      .then(setRegistry)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const pickTemplate = (entry) => {
    setRoleKey(entry.role_key);
    setRole(entry.role);
    setSummary(`Full ${entry.role} path from zero to job-ready.`);
  };

  const handleRoleChange = (value) => {
    setRole(value);
    if (!roleKey || roleKey === slugifyRoleKey(role)) {
      setRoleKey(slugifyRoleKey(value));
    }
  };

  const handleCreate = async () => {
    const key = roleKey.trim();
    if (!key || !role.trim()) {
      setStatus({ type: "error", message: "Role key and display name are required." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const doc = await scaffoldMasterRoadmap({
        role_key: key,
        role: role.trim(),
        summary: summary.trim() || null,
      });
      await createMasterRoadmap(key, doc);
      invalidateCache("admin:master-roadmap");
      invalidateCache("admin:master-roadmaps");
      router.push(`/admin/master-roadmaps/${key}`);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Could not create roadmap" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading..." />;
  if (error) return <ErrorBanner message={error.message} />;

  const missing = registry.filter((r) => !r.has_json);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <Link href="/admin/master-roadmaps" className="text-sm font-medium text-primary hover:underline">
          ← Master roadmaps
        </Link>
        <h1 className="mt-2 text-display-lg text-on-surface">Add master roadmap</h1>
        <p className="mt-1 text-sm text-secondary">Creates a new JSON file under backend/app/data/roadmaps/</p>
      </header>

      {missing.length > 0 && (
        <div className="rounded-2xl border border-outline-variant bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-on-surface">Quick start from template</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((entry) => (
              <button
                key={entry.role_key}
                type="button"
                onClick={() => pickTemplate(entry)}
                className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-secondary hover:border-primary hover:text-primary"
              >
                {entry.role}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-outline-variant bg-white p-5">
        <label className="block">
          <span className="text-sm font-medium text-on-surface">Display name</span>
          <input
            type="text"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            placeholder="e.g. Backend Developer"
            className="mt-1 w-full rounded-xl border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-on-surface">Role key</span>
          <input
            type="text"
            value={roleKey}
            onChange={(e) => setRoleKey(slugifyRoleKey(e.target.value))}
            placeholder="e.g. backend-developer"
            className="mt-1 w-full rounded-xl border border-outline-variant px-4 py-2.5 font-mono text-sm focus:border-primary focus:outline-none"
          />
          <span className="mt-1 block text-xs text-secondary">Lowercase letters, numbers, hyphens only</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-on-surface">Summary (optional)</span>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-line description for students"
            className="mt-1 w-full rounded-xl border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      {status && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{status.message}</div>
      )}

      <div className="flex gap-3">
        <Link
          href="/admin/master-roadmaps"
          className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-medium text-secondary hover:bg-surface-container-low"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create roadmap"}
        </button>
      </div>
    </div>
  );
}
