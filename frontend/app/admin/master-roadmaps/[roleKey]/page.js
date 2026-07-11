"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getMasterRoadmap, saveMasterRoadmap, validateMasterRoadmap } from "@/lib/adminApi";
import { CACHE_TTL, invalidateCache, loadWithCache, readCache } from "@/lib/resource-cache";

export default function AdminMasterRoadmapEditorPage() {
  const { roleKey } = useParams();
  const cacheKey = `admin:master-roadmap:${roleKey}`;
  const initial = readCache(cacheKey);

  const [doc, setDoc] = useState(initial.data);
  const [jsonText, setJsonText] = useState(initial.data ? JSON.stringify(initial.data, null, 2) : "");
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return loadWithCache(cacheKey, () => getMasterRoadmap(roleKey), CACHE_TTL.adminDetail)
      .then((data) => {
        setDoc(data);
        setJsonText(JSON.stringify(data, null, 2));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [cacheKey, roleKey]);

  useEffect(() => {
    load();
  }, [load]);

  const parseJson = () => {
    try {
      return JSON.parse(jsonText);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  };

  const handleValidate = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const payload = parseJson();
      const result = await validateMasterRoadmap(payload);
      setStatus({ type: "ok", message: `Valid — ${result.phase_count} phases, ${result.node_count} nodes` });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Validation failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const payload = parseJson();
      const saved = await saveMasterRoadmap(roleKey, payload);
      setDoc(saved);
      setJsonText(JSON.stringify(saved, null, 2));
      invalidateCache("admin:master-roadmap");
      invalidateCache("admin:master-roadmaps");
      setStatus({ type: "ok", message: "Saved to disk. Students need to regenerate roadmaps to see changes." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    if (doc) {
      setJsonText(JSON.stringify(doc, null, 2));
      setStatus(null);
    }
  };

  if (loading && !doc) return <LoadingState label="Loading roadmap..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;

  const nodeCount = (doc?.phases || []).reduce((n, p) => n + (p.nodes?.length || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/master-roadmaps" className="text-sm font-medium text-primary hover:underline">
            ← Master roadmaps
          </Link>
          <h1 className="mt-2 text-display-lg text-on-surface">{doc?.role || roleKey}</h1>
          <p className="mt-1 text-sm text-secondary">
            <span className="font-mono">{doc?.role_key}</span> · {doc?.roadmap_version} · {doc?.phases?.length || 0}{" "}
            phases · {nodeCount} nodes
          </p>
          {doc?.summary && <p className="mt-2 max-w-2xl text-sm text-secondary">{doc.summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-container-low disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={busy}
            className="rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </header>

      {status && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-outline-variant bg-white p-5">
          <h2 className="text-headline-sm font-bold text-on-surface">Path preview</h2>
          {(doc?.phases || []).map((phase) => (
            <div key={phase.id} className="rounded-xl border border-outline-variant/60 p-4">
              <p className="font-semibold text-on-surface">{phase.title}</p>
              <p className="mb-2 font-mono text-[10px] text-secondary">{phase.id}</p>
              <ol className="space-y-1.5 text-sm">
                {(phase.nodes || []).map((node) => (
                  <li key={node.id} className="flex flex-wrap items-baseline gap-2 text-secondary">
                    <span className="font-mono text-[10px] text-on-surface/60">{node.order}</span>
                    <span className="font-medium text-on-surface">{node.skill}</span>
                    {node.dependencies?.length > 0 && (
                      <span className="text-[10px]">← {node.dependencies.join(", ")}</span>
                    )}
                    {node.estimated_hours != null && (
                      <span className="text-[10px]">{node.estimated_hours}h</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-outline-variant bg-white p-5">
          <h2 className="mb-3 text-headline-sm font-bold text-on-surface">JSON</h2>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="h-[min(70vh,640px)] w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest p-4 font-mono text-xs leading-relaxed text-on-surface focus:border-primary focus:outline-none"
          />
          <p className="mt-2 text-xs text-secondary">
            Edits validate dependency DAG and unique node IDs before save. Bump <code>roadmap_version</code> when you
            ship structural changes.
          </p>
        </div>
      </div>
    </div>
  );
}
