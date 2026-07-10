"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory, startInterview } from "@/lib/api";
import { storeInterviewWelcome } from "@/hooks/useVoiceInterview";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MockInterviewPage() {
  const { profile, profileId } = useProfile();
  const router = useRouter();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInterviewHistory(profileId);
      setSessions(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await startInterview(profileId);
      storeInterviewWelcome(result.session.id, result.welcome_message);
      router.push(`/mock-interview/active?session=${result.session.id}`);
    } catch (err) {
      setError(err);
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-margin-desktop pb-20 pt-24">
      <div className="mb-12 mask-reveal">
        <nav className="mb-2 flex items-center gap-2 text-secondary">
          <span className="text-label-sm uppercase tracking-widest">Workspace</span>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm uppercase tracking-widest text-on-surface">
            Mock Interview Simulation
          </span>
        </nav>
        <h1 className="text-display-lg tracking-tight text-on-surface">
          Mock Interview Simulation
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          An adaptive, AI-driven interview for the{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span> role —
          one question at a time, scored and explained as you go.
        </p>
      </div>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      <section className="mb-section-gap rounded-xl border border-outline-variant bg-white p-10 ambient-shadow mask-reveal">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              New Session
            </span>
            <h2 className="mb-2 text-headline-lg text-on-surface">
              Start a live voice interview
            </h2>
            <p className="max-w-xl text-body-md text-secondary">
              DISHA speaks each question aloud — answer with your microphone for a real interview
              feel. Scored feedback after every turn. Text mode available if you prefer typing.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-secondary">
              <Icon name="mic" size={16} />
              Microphone recommended — text mode available as fallback
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="w-full shrink-0 rounded-xl bg-primary px-10 py-4 text-center text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary-container active:scale-95 disabled:opacity-60 md:w-fit"
          >
            {starting ? "Starting…" : "Start Live Voice Interview"}
          </button>
        </div>
      </section>

      <section className="mask-reveal">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-headline-md font-bold text-on-surface">Interview History</h3>
        </div>

        {loading ? (
          <LoadingState label="Loading your interview history..." />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="record_voice_over"
            title="No interviews yet"
            description="Start your first mock interview above to get scored, actionable feedback."
          />
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() =>
                  router.push(
                    session.status === "completed"
                      ? `/mock-interview/report?session=${session.id}`
                      : `/mock-interview/active?session=${session.id}`
                  )
                }
                className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-outline-variant bg-white p-5 text-left transition-colors hover:border-primary"
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-secondary transition-colors group-hover:bg-primary-fixed group-hover:text-primary">
                    <Icon name="description" />
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">
                      {session.target_role} • {session.track === "tech" ? "Technical" : "Role-specific"}
                    </p>
                    <p className="text-sm text-secondary">
                      {formatDate(session.started_at)} •{" "}
                      {session.status === "completed" ? "Completed" : "In progress"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-on-surface">
                    {session.overall_score != null ? `${Math.round(session.overall_score * 10)}%` : "—"}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-secondary">
                    {session.status === "completed" ? "Overall Score" : "Continue"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
