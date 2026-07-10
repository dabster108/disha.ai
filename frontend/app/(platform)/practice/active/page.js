"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useVoicePractice } from "@/hooks/useVoicePractice";
import SessionSidebar from "@/components/interview/SessionSidebar";
import MicButton from "@/components/interview/MicButton";
import LiveTranscript from "@/components/interview/LiveTranscript";
import SpeakingWaveform from "@/components/interview/SpeakingWaveform";
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
    transcript,
    error,
    setError,
    textMode,
    setTextMode,
    autoContinue,
    setAutoContinue,
    lastScore,
    coachTip,
    submitting,
    muted,
    setMuted,
    ttsUnavailable,
    recorder,
    skipSpeaking,
    toggleRecording,
    startHoldRecording,
    stopHoldRecording,
    continueFromFeedback,
    submitCodingAnswer,
    submitTextScenarioAnswer,
    completedSummary,
    timer,
    challengeWarning,
    sessionWarning,
    result,
  } = useVoicePractice({ sessionId, router });

  if (sessionState === "loading" || (!challenge && !completedSummary)) {
    return <LoadingState label="Loading practice session..." />;
  }

  if (completedSummary) {
    const isTimeout = sessionState === "session_timeout";
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-outline-variant bg-white p-10 ambient-shadow">
          <span className={`mb-3 inline-block rounded-full px-3 py-1 text-label-sm font-bold ${
            isTimeout ? "bg-error/15 text-error" : "bg-primary/10 text-primary"
          }`}>
            {isTimeout ? "Time's Up (Partial Summary)" : "Session Complete"}
          </span>
          <h1 className="mb-2 text-headline-lg text-on-surface">
            Overall score: {completedSummary.overall_score?.toFixed(1) ?? "—"}/10
          </h1>
          {completedSummary.summary && (
            <p className="mb-8 text-body-md text-secondary leading-relaxed">{completedSummary.summary}</p>
          )}

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-label-md font-bold uppercase text-primary">
                Verified Strong
              </h4>
              <div className="flex flex-wrap gap-2">
                {(completedSummary.verified_strong_skills || []).length === 0 && (
                  <span className="text-sm text-secondary">None yet</span>
                )}
                {(completedSummary.verified_strong_skills || []).map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-label-md font-bold uppercase text-tertiary">
                Needs Work
              </h4>
              <div className="flex flex-wrap gap-2">
                {(completedSummary.verified_weak_skills || []).length === 0 && (
                  <span className="text-sm text-secondary">None</span>
                )}
                {(completedSummary.verified_weak_skills || []).map((s) => (
                  <span key={s} className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              href="/skill-gap"
              className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition-all hover:bg-primary-container"
            >
              Run Skill Gap Analysis
            </Link>
            <Link
              href="/practice"
              className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface transition-all hover:bg-surface-container-low"
            >
              Practice More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dishaSpeaking = sessionState === "disha_speaking";
  const recording = sessionState === "recording";
  const listening = sessionState === "listening";
  const isCoding = challenge.challenge_type === "coding";

  const challengeDurationMs = Math.max(2, Math.floor(timer.sessionDurationMinutes / (session?.skills_selected?.length || 3))) * 60 * 1000;

  return (
    <div className="mx-auto max-w-7xl px-margin-desktop py-12">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Workspace Column */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <div>
              <span className="text-label-sm uppercase tracking-widest text-primary block">
                Challenge {challenge.challenge_index + 1} of {session?.skills_selected?.length} • {challenge.difficulty}
              </span>
              <h1 className="text-headline-md font-bold text-on-surface mt-1">{challenge.skill}</h1>
            </div>
            
            {/* Quick Timer display for Coding */}
            {isCoding && (
              <div className="w-64">
                <ChallengeTimer 
                  remainingMs={timer.challengeRemainingMs} 
                  totalMs={challengeDurationMs} 
                />
              </div>
            )}
          </div>

          {error && (
            <ErrorBanner message={error.message} onRetry={() => setError(null)} />
          )}

          {/* Video-Call style Workspace */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[280px]">
            
            {/* DISHA Coach panel */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/60 bg-gradient-to-br from-primary/10 via-surface-container-low to-primary-fixed/40 p-8">
              <div className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all ${
                dishaSpeaking 
                  ? "border-primary bg-primary/15 shadow-lg shadow-primary/20 animate-pulse" 
                  : "border-outline-variant bg-white"
              }`}>
                {dishaSpeaking ? (
                  <SpeakingWaveform active={dishaSpeaking} bars={7} color="bg-primary" />
                ) : (
                  <Icon name="smart_toy" size={48} className="text-primary" />
                )}
              </div>
              <p className="text-label-md font-bold text-on-surface">DISHA Coach</p>
              <p className="text-sm text-secondary">{dishaSpeaking ? "Speaking..." : "Ready"}</p>
            </div>

            {/* You Panel OR Code Arena */}
            {isCoding ? (
              <div className="md:col-span-2 rounded-2xl border border-outline-variant/60 bg-white p-6">
                <CodeArena 
                  value={code} 
                  onChange={setCode} 
                  language={challenge.expected_language}
                  explanation={explanation}
                  onExplanationChange={setExplanation}
                  disabled={submitting || sessionState === "evaluating"}
                />
              </div>
            ) : (
              /* Scenario You / Recording Panel */
              textMode ? (
                <div className="flex flex-col rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6">
                  <label className="mb-2 block text-label-md font-bold text-on-surface">Your Response (Text Fallback)</label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting || sessionState === "evaluating"}
                    rows={8}
                    placeholder="Describe how you would handle this scenario..."
                    className="w-full h-full resize-none rounded-xl border border-outline-variant p-4 text-body-md focus:border-primary focus:outline-none bg-white"
                  />
                </div>
              ) : (
                <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/60 bg-gradient-to-br from-surface-container-low to-surface-container p-8">
                  <div className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all ${
                    recording
                      ? "border-error bg-error/15 shadow-lg shadow-error/20"
                      : listening
                        ? "border-tertiary bg-tertiary-fixed/30"
                        : "border-outline-variant bg-white"
                  }`}>
                    {recording || (listening && recorder.volume > 0.05) ? (
                      <SpeakingWaveform active={true} bars={7} color={recording ? "bg-error" : "bg-tertiary"} />
                    ) : (
                      <Icon name="person" size={48} className="text-secondary" />
                    )}
                  </div>
                  <p className="text-label-md font-bold text-on-surface">You (Live)</p>
                  <p className="text-sm text-secondary">
                    {recording 
                      ? `Recording (${Math.floor(recorder.durationMs / 1000)}s)` 
                      : listening 
                        ? "Your turn — speak now" 
                        : "Ready"}
                  </p>
                </div>
              )
            )}
          </div>

          {/* Challenge Prompt Description (always on screen) */}
          <div className="rounded-2xl border border-outline-variant/60 bg-white p-6" aria-live="polite">
            <span className="mb-2 block text-label-sm uppercase tracking-wider text-primary font-bold">
              Challenge Question
            </span>
            <p className="text-body-lg leading-relaxed text-on-surface whitespace-pre-wrap">
              {challenge.prompt}
            </p>
          </div>

          {/* Transcript / Feedback Section */}
          {transcript && (
            <div className="rounded-2xl border border-outline-variant/60 bg-white p-6" aria-live="polite">
              <span className="mb-2 block text-label-sm uppercase tracking-wider text-secondary font-bold">
                Spoken Transcript
              </span>
              <p className="text-body-md text-on-surface font-medium">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Score card / feedback state */}
          {result && sessionState === "feedback" && (
            <div className={`rounded-xl border-l-4 p-6 ${
              result.passed ? "border-primary bg-primary/5" : "border-tertiary bg-tertiary-fixed/30"
            }`} aria-live="polite">
              <div className="mb-3 flex items-center justify-between">
                <span className={`text-label-sm font-bold uppercase tracking-wider ${
                  result.passed ? "text-primary" : "text-tertiary"
                }`}>
                  {result.passed ? "Passed" : "Not yet"} • {result.verified_skill_level}
                </span>
                <span className="text-headline-md font-bold text-on-surface">
                  {result.score}/10
                </span>
              </div>
              <p className="text-body-md text-on-surface-variant font-medium leading-relaxed">{result.feedback}</p>
            </div>
          )}

          {/* Actions / Submissions Area */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-6">
            
            {/* Left aligned fallback & TTS actions */}
            {!isCoding && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTextMode(!textMode)}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-label-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  <Icon name={textMode ? "mic" : "keyboard"} size={18} />
                  {textMode ? "Use Mic Mode" : "Use Text Mode"}
                </button>

                {dishaSpeaking && (
                  <button
                    type="button"
                    onClick={skipSpeaking}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-label-sm font-bold text-on-surface hover:bg-secondary-container transition-colors"
                  >
                    <Icon name="skip_next" size={18} />
                    Skip Spoken Prompt
                  </button>
                )}
              </div>
            )}

            {/* Right aligned submit controls */}
            <div className="flex items-center gap-4 ml-auto">
              
              {/* Mic mode scenario controls */}
              {!isCoding && !textMode && (
                <MicButton
                  sessionState={sessionState}
                  isRecording={recording}
                  disabled={submitting || sessionState === "evaluating"}
                  onToggle={toggleRecording}
                  onHoldStart={startHoldRecording}
                  onHoldEnd={stopHoldRecording}
                />
              )}

              {/* Text mode scenario submit */}
              {!isCoding && textMode && (
                <button
                  type="button"
                  onClick={() => submitTextScenarioAnswer()}
                  disabled={submitting || sessionState === "evaluating" || !answer.trim()}
                  className="rounded-xl bg-primary px-8 py-3 text-label-md font-bold text-on-primary hover:bg-primary-container disabled:opacity-50 transition-all"
                >
                  {submitting ? "Grading..." : "Submit Response"}
                </button>
              )}

              {/* Coding submit */}
              {isCoding && sessionState === "coding" && (
                <button
                  type="button"
                  onClick={() => submitCodingAnswer()}
                  disabled={submitting || sessionState === "evaluating" || !code.trim()}
                  className="rounded-xl bg-primary px-8 py-3 text-label-md font-bold text-on-primary hover:bg-primary-container disabled:opacity-50 transition-all"
                >
                  {submitting ? "Grading..." : "Submit Code"}
                </button>
              )}

              {/* Continue button for feedback screen */}
              {sessionState === "feedback" && (
                <button
                  type="button"
                  onClick={() => continueFromFeedback()}
                  className="rounded-xl bg-primary px-8 py-3 text-label-md font-bold text-on-primary hover:bg-primary-container transition-colors"
                >
                  {result?.next_challenge ? "Next Challenge" : "View Summary"}
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1">
          <SessionSidebar
            sessionState={sessionState}
            sessionStartTime={session ? new Date(session.started_at).getTime() : null}
            lastScore={lastScore}
            coachTip={coachTip}
            currentTurnIndex={challenge ? challenge.challenge_index + 1 : null}
            track={session?.track}
            difficulty={session?.difficulty}
            autoContinue={autoContinue}
            onAutoContinueChange={setAutoContinue}
            showRecordingWarning={challengeWarning}
            isPractice={true}
            sessionRemainingMs={timer.sessionRemainingMs}
            challengeRemainingMs={isCoding ? timer.challengeRemainingMs : undefined}
          />
        </div>

      </div>
    </div>
  );
}
