"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import CodeArena from "@/components/practice/CodeArena";
import ChallengeTimer from "@/components/practice/ChallengeTimer";

export default function ActivePracticePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const {
    sessionState,
    session,
    challenge,
    code,
    setCode,
    explanation,
    setExplanation,
    answer,
    setAnswer,
    error,
    setError,
    submitting,
    result,
    submitCodingAnswer,
    submitScenarioAnswer,
    continueFromFeedback,
    completedSummary,
    timer,
    challengeWarning,
    sessionDurationMinutes,
  } = usePracticeSession({ sessionId, router });

  if (sessionState === "loading" || (!challenge && !completedSummary)) {
    return <LoadingState label="Loading practice session…" />;
  }

  if (completedSummary) {
    const isTimeout = sessionState === "session_timeout";
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-10">
          <span
            className={`mb-3 inline-block rounded-full px-3 py-1 text-label-sm font-bold ${
              isTimeout ? "bg-error/15 text-error" : "bg-primary/10 text-primary"
            }`}
          >
            {isTimeout ? "Time's up" : "Session complete"}
          </span>
          <h1 className="mb-2 text-headline-lg text-on-surface">
            Overall score: {completedSummary.overall_score?.toFixed(1) ?? "—"}/10
          </h1>
          {completedSummary.summary && (
            <p className="mb-8 text-body-md leading-relaxed text-secondary">{completedSummary.summary}</p>
          )}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-label-md font-bold uppercase text-primary">Verified strong</h4>
              <div className="flex flex-wrap gap-2">
                {(completedSummary.verified_strong_skills || []).map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-label-md font-bold uppercase text-tertiary">Needs work</h4>
              <div className="flex flex-wrap gap-2">
                {(completedSummary.verified_weak_skills || []).map((s) => (
                  <span key={s} className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <Link href="/skill-gap" className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary">
              Run Skill Gap
            </Link>
            <Link
              href="/practice"
              className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface"
            >
              Practice more
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCoding = challenge.challenge_type === "coding";
  const challengeDurationMs =
    Math.max(2, Math.floor(sessionDurationMinutes / (session?.skills_selected?.length || 3))) * 60 * 1000;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-primary">
            Challenge {challenge.challenge_index + 1} of {session?.skills_selected?.length} · {challenge.difficulty}
          </p>
          <h1 className="text-headline-md font-bold text-on-surface">{challenge.skill}</h1>
        </div>
        {isCoding && (
          <div className="w-48">
            <ChallengeTimer remainingMs={timer.challengeRemainingMs} totalMs={challengeDurationMs} />
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
        <p className="mb-2 text-label-sm font-bold uppercase tracking-wider text-primary">Challenge</p>
        <p className="whitespace-pre-wrap text-body-lg leading-relaxed text-on-surface">{challenge.prompt}</p>
      </div>

      {isCoding ? (
        <CodeArena
          value={code}
          onChange={setCode}
          language={challenge.expected_language}
          explanation={explanation}
          onExplanationChange={setExplanation}
          disabled={submitting || sessionState === "evaluating"}
        />
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitting || sessionState === "evaluating"}
          rows={10}
          placeholder="Write your response…"
          className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}

      {result && sessionState === "feedback" && (
        <div
          className={`mt-6 rounded-xl border-l-4 p-5 ${
            result.passed ? "border-primary bg-primary/5" : "border-tertiary bg-tertiary-fixed/30"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label-sm font-bold uppercase text-on-surface">
              {result.passed ? "Passed" : "Not yet"} · {result.verified_skill_level}
            </span>
            <span className="text-headline-md font-bold">{result.score}/10</span>
          </div>
          <p className="text-body-md text-secondary">{result.feedback}</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {challengeWarning && (
          <p className="text-sm font-medium text-error">Less than 30 seconds left on this challenge.</p>
        )}
        <div className="ml-auto flex gap-3">
          {sessionState === "feedback" ? (
            <button
              type="button"
              onClick={continueFromFeedback}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary"
            >
              {result?.next_challenge ? "Next challenge" : "View summary"}
            </button>
          ) : isCoding ? (
            <button
              type="button"
              onClick={() => submitCodingAnswer()}
              disabled={submitting || !code.trim()}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary disabled:opacity-50"
            >
              {submitting ? "Grading…" : "Submit code"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submitScenarioAnswer()}
              disabled={submitting || !answer.trim()}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary disabled:opacity-50"
            >
              {submitting ? "Grading…" : "Submit response"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
