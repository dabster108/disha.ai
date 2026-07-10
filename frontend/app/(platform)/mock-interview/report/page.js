"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory } from "@/lib/api";

const SCORE_LABELS = [
  { min: 8.5, label: "Excellent", cls: "text-primary" },
  { min: 7, label: "Strong", cls: "text-primary" },
  { min: 5.5, label: "Good", cls: "text-tertiary" },
  { min: 0, label: "Needs Work", cls: "text-error" },
];

function scoreLabel(score) {
  if (score == null) return null;
  return SCORE_LABELS.find((s) => score >= s.min);
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function DimensionBars({ scores }) {
  const entries = Object.entries(scores || {}).filter(([, v]) => typeof v === "number");
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {entries.map(([dim, val]) => (
        <div key={dim}>
          <div className="mb-1 flex items-center justify-between text-[11px] text-secondary">
            <span className="capitalize">{dim}</span>
            <span className="font-bold text-on-surface">{val}/10</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(val / 10) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TurnCard({ turn }) {
  const [expanded, setExpanded] = useState(false);
  const dims = turn.dimensions || {};
  const isOffTopic = Boolean(dims.off_topic);
  const answerPreview = turn.answer || "No answer recorded.";
  const isLong = answerPreview.length > 160;

  return (
    <div
      className={`rounded-xl border p-5 ${
        isOffTopic ? "border-error/30 bg-error-container/20" : "border-outline-variant bg-white"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <span className="text-label-sm font-bold uppercase tracking-wider text-secondary">
            Question {turn.turn_index}
            {turn.skill_tag ? ` • ${turn.skill_tag}` : ""}
          </span>
          <p className="mt-1 text-body-md font-semibold text-on-surface">{turn.question}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-headline-sm font-bold ${isOffTopic ? "text-error" : "text-on-surface"}`}>
            {turn.score != null ? `${turn.score}/10` : "—"}
          </span>
          {isOffTopic && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase text-error">
              <Icon name="block" size={12} />
              Off-topic
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full rounded-lg bg-surface-container-lowest p-3 text-left text-sm text-on-surface-variant"
      >
        <span className={isLong && !expanded ? "line-clamp-2" : ""}>{answerPreview}</span>
        {isLong && (
          <span className="mt-1 block text-xs font-bold text-primary">{expanded ? "Show less" : "Show more"}</span>
        )}
      </button>

      {turn.feedback && <p className="mt-3 text-sm text-secondary">{turn.feedback}</p>}
      <DimensionBars scores={dims.scores} />
    </div>
  );
}

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
  const answeredTurns = turns.filter((t) => t.answer != null);
  const isPartial = session.status !== "completed" || answeredTurns.length < 2;
  const label = scoreLabel(session.overall_score);
  const duration = formatDuration(session.started_at, session.finished_at);
  const oneLineSummary = session.summary ? session.summary.split("\n").find((l) => l.trim()) : null;

  const offTopicCount = turns.filter((t) => t.dimensions?.off_topic).length;

  // Weak skills to practice next: low-scoring or off-topic turns' skill_tag,
  // deduped, ranked lowest-score-first — these are already catalog names
  // since they come from the student's own (catalog-filtered) profile skills.
  const weakSkills = [
    ...new Map(
      turns
        .filter((t) => t.skill_tag && (t.dimensions?.off_topic || (t.score != null && t.score < 5)))
        .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
        .map((t) => [t.skill_tag, t.skill_tag])
    ).values(),
  ].slice(0, 3);

  return (
    <div className="min-h-screen p-6 md:p-12">
      <header className="mb-10 mask-reveal print:hidden">
        <nav className="mb-4 flex items-center gap-2 text-secondary">
          <Link href="/mock-interview" className="text-label-sm hover:text-primary">
            Mock Interview
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm text-on-surface">Report Card</span>
        </nav>
      </header>

      {isPartial && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-tertiary/30 bg-tertiary-fixed/15 p-5 print:hidden">
          <Icon name="info" className="mt-0.5 shrink-0 text-tertiary" />
          <div>
            <p className="text-label-md font-bold text-on-surface">Session ended early — limited data</p>
            <p className="mt-1 text-sm text-secondary">
              {answeredTurns.length === 0
                ? "No questions were answered before the session ended, so there's nothing to score yet."
                : `Only ${answeredTurns.length} question${answeredTurns.length === 1 ? "" : "s"} were answered. Take a full-length interview for a complete report.`}
            </p>
          </div>
        </div>
      )}

      <div className="mb-12 flex flex-col gap-6 rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow md:flex-row md:items-center md:justify-between">
        <div>
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
            {session.status === "completed" ? "Session Complete" : "Ended Early"}
          </span>
          <h1 className="text-display-lg text-on-surface">Interview Report Card</h1>
          <p className="mt-2 text-body-lg text-secondary">
            {session.target_role} • {session.track === "tech" ? "Technical" : "Role"} • {session.difficulty} •{" "}
            {new Date(session.started_at).toLocaleDateString()}
            {duration ? ` • ${duration}` : ""}
          </p>
          {oneLineSummary && <p className="mt-3 max-w-2xl text-body-md text-on-surface-variant">{oneLineSummary}</p>}
        </div>
        <div className="shrink-0 text-center">
          <div className={`text-[64px] font-bold leading-none ${label?.cls || "text-on-surface"}`}>
            {session.overall_score != null ? session.overall_score.toFixed(1) : "—"}
          </div>
          <p className="text-label-sm uppercase tracking-widest text-secondary">out of 10</p>
          {label && (
            <p className={`mt-1 text-label-md font-bold uppercase tracking-wide ${label.cls}`}>{label.label}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-7">
          <h3 className="mb-4 text-headline-md font-bold text-on-surface">Score Breakdown</h3>
          {offTopicCount > 0 && (
            <p className="mb-4 flex items-center gap-2 text-sm text-error">
              <Icon name="warning" size={16} />
              {offTopicCount} answer{offTopicCount === 1 ? "" : "s"} flagged off-topic — scored low and excluded
              from meaningful skill signal.
            </p>
          )}
          {turns.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-body-md text-secondary">
              No questions were recorded for this session.
            </p>
          ) : (
            <div className="space-y-4">
              {turns.map((turn) => (
                <TurnCard key={turn.id} turn={turn} />
              ))}
            </div>
          )}
        </section>

        <section className="col-span-12 space-y-6 lg:col-span-5">
          {(session.strengths?.length > 0 || session.weaknesses?.length > 0) && (
            <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow">
              <h3 className="mb-4 text-headline-md font-bold">Strengths &amp; Weaknesses</h3>
              <div className="space-y-3">
                {(session.strengths || []).map((s) => (
                  <div key={s} className="rounded-xl border-l-4 border-primary bg-primary/5 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon name="thumb_up" size={18} className="text-primary" />
                      <h4 className="text-label-md font-bold">Strength</h4>
                    </div>
                    <p className="text-sm text-secondary">{s}</p>
                  </div>
                ))}
                {(session.weaknesses || []).map((w) => (
                  <div key={w} className="rounded-xl border-l-4 border-tertiary bg-tertiary-fixed/30 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon name="tips_and_updates" size={18} className="text-tertiary" />
                      <h4 className="text-label-md font-bold">Area to improve</h4>
                    </div>
                    <p className="text-sm text-secondary">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {weakSkills.length > 0 && (
            <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow print:hidden">
              <h3 className="mb-4 text-headline-md font-bold">What to Practice Next</h3>
              <div className="mb-5 flex flex-wrap gap-2">
                {weakSkills.map((skill) => (
                  <span key={skill} className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed">
                    {skill}
                  </span>
                ))}
              </div>
              <Link
                href={`/practice?skills=${encodeURIComponent(weakSkills.join(","))}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-label-md font-bold text-on-primary hover:bg-primary-container"
              >
                <Icon name="fitness_center" size={18} />
                Practice these skills
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-outline-variant bg-gradient-to-br from-primary to-[#003fa4] p-8 text-white print:hidden">
            <div className="mb-4 flex items-center gap-3">
              <Icon name="route" />
              <span className="text-label-sm font-bold uppercase tracking-widest">Next Step</span>
            </div>
            <h3 className="mb-4 text-headline-md font-bold">Update your skill gap analysis</h3>
            <p className="mb-6 text-body-md text-white/80">
              This interview&apos;s strengths and weaknesses feed directly into your skill gap
              report — run it now to get an updated readiness score and roadmap.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/skill-gap"
                className="rounded-xl bg-white px-6 py-3 font-bold text-primary transition-all hover:bg-surface-container-lowest"
              >
                Update Skill Gap
              </Link>
              <Link
                href="/mock-interview"
                className="rounded-xl border border-white/20 px-6 py-3 font-bold transition-all hover:bg-white/10"
              >
                Practice Again
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/20 px-6 py-3 font-bold transition-all hover:bg-white/10"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden w-full items-center justify-center gap-2 rounded-xl border border-outline-variant py-3 text-label-md font-bold text-on-surface hover:bg-surface-container-low md:flex print:hidden"
          >
            <Icon name="print" size={18} />
            Print / Save as PDF
          </button>
        </section>
      </div>
    </div>
  );
}
