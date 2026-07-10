"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getScrapeRuns, getSourceRanking, triggerScrape } from "@/lib/adminApi";

const MODES = ["hybrid", "aggregator", "direct"];

export default function AdminScrapePage() {
  const [runs, setRuns] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [mode, setMode] = useState("hybrid");
  const [maxPerSource, setMaxPerSource] = useState(150);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.allSettled([getScrapeRuns(20), getSourceRanking()]).then(([runsRes, rankRes]) => {
      if (runsRes.status === "fulfilled") setRuns(runsRes.value);
      else setError(runsRes.reason);
      if (rankRes.status === "fulfilled") setRanking(rankRes.value);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleTrigger = async () => {
    setTriggering(true);
    setMessage(null);
    setError(null);
    try {
      const res = await triggerScrape({ mode, max_per_source: Number(maxPerSource), reingest_chroma: true });
      setMessage(`Scrape started — run ${res.scrape_run_id}`);
      setTimeout(load, 2000);
    } catch (err) {
      setError(err);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-display-lg text-on-surface">Scrape Pipeline</h1>
        <p className="mt-1 text-body-md text-secondary">Trigger and monitor the live Nepal job scrape.</p>
      </header>

      {error && <ErrorBanner message={error.message} onRetry={load} />}
      {message && <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">{message}</p>}

      <div className="rounded-2xl border border-outline-variant bg-white p-6">
        <h3 className="mb-4 text-headline-sm font-bold text-on-surface">Trigger a scrape</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs uppercase text-secondary">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="rounded-xl border border-outline-variant px-3 py-2 text-sm"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-secondary">Max per source</label>
            <input
              type="number"
              value={maxPerSource}
              onChange={(e) => setMaxPerSource(e.target.value)}
              className="w-32 rounded-xl border border-outline-variant px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary disabled:opacity-60"
          >
            {triggering ? "Starting..." : "Run Scrape"}
          </button>
        </div>
      </div>

      {ranking && (
        <div className="rounded-2xl border border-outline-variant bg-white p-6">
          <h3 className="mb-4 text-headline-sm font-bold text-on-surface">Source Ranking (latest run)</h3>
          <div className="space-y-2">
            {(ranking.ranking || []).map((r, i) => (
              <div key={r.source || i} className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-3 text-sm">
                <span className="font-semibold text-on-surface">{r.source}</span>
                <span className="text-secondary">
                  {r.jobs} jobs • {r.skills_pct}% skills • {r.location_pct}% location
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading scrape history..." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs uppercase tracking-wider text-secondary">
              <tr>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Jobs</th>
                <th className="px-5 py-3">Dedup</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                        r.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : r.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-secondary">{r.scrape_mode}</td>
                  <td className="px-5 py-3 font-bold text-on-surface">{r.jobs_count}</td>
                  <td className="px-5 py-3 text-secondary">{r.dedup_removed}</td>
                  <td className="px-5 py-3 text-secondary">{r.duration_seconds ? `${Math.round(r.duration_seconds)}s` : "—"}</td>
                  <td className="px-5 py-3 text-secondary">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <p className="p-8 text-center text-sm text-secondary">No scrape runs yet.</p>}
        </div>
      )}
    </div>
  );
}
