"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory } from "@/lib/api";

export default function InterviewReportPage() {
  const { profileId } = useProfile();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await getInterviewHistory(profileId);
      const found = sessions.find((s) => s.id === sessionId);
      if (!found) {
        setError(new Error("Interview session not found."));
        return;
      }
      setSession(found);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId && sessionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, sessionId]);

  if (loading) return <LoadingState label="Loading report..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }
  if (!session) return null;

  const turns = [...session.turns].sort((a, b) => a.turn_index - b.turn_index);

  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <nav className="mb-4 flex items-center gap-2 text-secondary">
          <Link href="/mock-interview" className="text-label-sm hover:text-primary">
            Mock Interview
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm text-on-surface">Performance Report</span>
        </nav>
        <div className="flex items-end justify-between">
          <div>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              {session.status === "completed" ? "Session Complete" : "In Progress"}
            </span>
            <h1 className="text-display-lg text-on-surface">Interview Performance Report</h1>
            <p className="mt-2 text-body-lg text-secondary">
              {session.target_role} • {new Date(session.started_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-center">
            <div className="text-[64px] font-bold leading-none text-primary">
              {session.overall_score != null ? Math.round(session.overall_score * 10) : "—"}
            </div>
            <p className="text-label-sm uppercase tracking-widest text-secondary">Overall Score</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-5">
          <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow">
            <h3 className="mb-6 text-headline-md font-bold">Question Scores</h3>
            <div className="space-y-5">
              {turns.map((turn) => (
                <div key={turn.id}>
                  <div className="mb-1 flex items-center justify-between text-label-sm">
                    <span className="text-secondary">
                      Q{turn.turn_index} • {turn.question_type}
                    </span>
                    <span className="font-bold text-on-surface">
                      {turn.score != null ? `${turn.score}/10` : "—"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${((turn.score ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="col-span-12 space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow">
            <h3 className="mb-6 text-headline-md font-bold">AI Analysis</h3>
            {session.summary && (
              <p className="mb-6 text-body-md text-on-surface-variant">{session.summary}</p>
            )}
            <div className="space-y-4">
              {(session.strengths || []).map((s) => (
                <div key={s} className="rounded-xl border-l-4 border-primary bg-primary/5 p-5">
                  <div className="mb-1 flex items-center gap-2">
                    <Icon name="thumb_up" className="text-primary" />
                    <h4 className="text-label-md font-bold">Strength</h4>
                  </div>
                  <p className="text-body-md text-secondary">{s}</p>
                </div>
              ))}
              {(session.weaknesses || []).map((w) => (
                <div key={w} className="rounded-xl border-l-4 border-tertiary bg-tertiary-fixed/30 p-5">
                  <div className="mb-1 flex items-center gap-2">
                    <Icon name="tips_and_updates" className="text-tertiary" />
                    <h4 className="text-label-md font-bold">Area to improve</h4>
                  </div>
                  <p className="text-body-md text-secondary">{w}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-gradient-to-br from-primary to-[#003fa4] p-8 text-white">
            <div className="mb-4 flex items-center gap-3">
              <Icon name="route" />
              <span className="text-label-sm font-bold uppercase tracking-widest">Next Step</span>
            </div>
            <h3 className="mb-4 text-headline-md font-bold">Run your skill gap analysis</h3>
            <p className="mb-6 text-body-md text-white/80">
              This interview&apos;s strengths and weaknesses feed directly into your skill gap
              report — run it now to get an updated readiness score and roadmap.
            </p>
            <div className="flex gap-4">
              <Link
                href="/skill-gap"
                className="rounded-xl bg-white px-6 py-3 font-bold text-primary transition-all hover:bg-surface-container-lowest"
              >
                View Skill Gap
              </Link>
              <Link
                href="/mock-interview"
                className="rounded-xl border border-white/20 px-6 py-3 font-bold transition-all hover:bg-white/10"
              >
                Practice Again
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
