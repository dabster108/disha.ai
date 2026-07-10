"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useProfile } from "@/context/ProfileContext";
import { getLeaderboard } from "@/lib/api";

function ActivityPills({ activities }) {
  if (!activities?.length) {
    return <span className="text-xs text-secondary">No activity yet</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {activities.map((a) => (
        <span
          key={a}
          className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-secondary"
        >
          {a}
        </span>
      ))}
    </div>
  );
}

const CATEGORY_META = {
  interview: { label: "Interview", max: 10 },
  practice: { label: "Practice", max: 10 },
  skill_gap: { label: "Gap", max: 100 },
  roadmap: { label: "Roadmap", max: 100 },
};

function CategoryMiniBars({ scores }) {
  if (!scores) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Object.entries(CATEGORY_META).map(([key, meta]) => {
        const value = scores[key] || 0;
        const pct = Math.min(100, Math.round((value / meta.max) * 100));
        return (
          <div key={key} className="min-w-[70px]">
            <div className="mb-1 flex items-center justify-between text-[10px] text-secondary">
              <span>{meta.label}</span>
              <span className="font-bold text-on-surface">{value}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeaderboardPage() {
  const { profileId } = useProfile();
  const [entries, setEntries] = useState([]);
  const [yourRank, setYourRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLeaderboard(profileId);
      setEntries(res.entries || []);
      setYourRank(res.your_rank);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Loading leaderboard..." />;

  return (
    <div className="mx-auto max-w-5xl px-margin-desktop pb-20 pt-16">
      <header className="mb-10 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          See who has run skill gaps, built roadmaps, completed interviews, and practiced skills.
          Scores blend readiness, interview performance, and practice results.
        </p>
        {yourRank != null && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-label-md font-bold text-primary">
            <Icon name="emoji_events" size={18} />
            Your rank: #{yourRank}
          </p>
        )}
      </header>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon="leaderboard"
          title="No one on the board yet"
          description="Complete a skill gap, interview, or practice session to appear here."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const isYou = entry.profile_id === profileId;
            const rank = index + 1;
            return (
              <div
                key={entry.profile_id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border p-5 transition-colors ${
                  isYou
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-outline-variant bg-white hover:border-primary/40"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label-md font-bold ${
                    rank === 1
                      ? "bg-amber-100 text-amber-700"
                      : rank === 2
                        ? "bg-slate-200 text-slate-700"
                        : rank === 3
                          ? "bg-orange-100 text-orange-800"
                          : "bg-surface-container-low text-secondary"
                  }`}
                >
                  {rank}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-md font-bold text-on-surface">
                      {entry.full_name}
                      {isYou && (
                        <span className="ml-2 text-xs font-semibold text-primary">(You)</span>
                      )}
                    </p>
                    <span className="text-xs text-secondary">{entry.target_role}</span>
                  </div>
                  <div className="mt-2">
                    <ActivityPills activities={entry.activities} />
                  </div>
                  <div className="mt-3 max-w-md">
                    <CategoryMiniBars scores={entry.category_scores} />
                  </div>
                </div>

                <div className="flex shrink-0 gap-6 text-right text-sm">
                  <div>
                    <p className="text-lg font-bold text-on-surface">
                      {entry.readiness_score != null ? `${Math.round(entry.readiness_score)}%` : "—"}
                    </p>
                    <p className="text-xs text-secondary">Readiness</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-on-surface">
                      {entry.interview_avg != null ? `${entry.interview_avg}/10` : "—"}
                    </p>
                    <p className="text-xs text-secondary">Interview</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-on-surface">
                      {entry.practice_avg != null ? `${entry.practice_avg}/10` : "—"}
                    </p>
                    <p className="text-xs text-secondary">Practice</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">{entry.composite_score}/10</p>
                    <p className="text-xs text-secondary">Overall</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
