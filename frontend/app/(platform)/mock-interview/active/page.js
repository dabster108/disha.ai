"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { useVoiceInterview } from "@/hooks/useVoiceInterview";
import InterviewStage from "@/components/interview/InterviewStage";
import MicButton from "@/components/interview/MicButton";
import LiveTranscript from "@/components/interview/LiveTranscript";
import SessionSidebar from "@/components/interview/SessionSidebar";

export default function ActiveInterviewPage() {
  const { profileId } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const voice = useVoiceInterview({ sessionId, profileId, router });

  const {
    sessionState,
    session,
    currentTurn,
    evaluated,
    nextTurn,
    transcript,
    textAnswer,
    setTextAnswer,
    error,
    setError,
    textMode,
    setTextMode,
    ttsUnavailable,
    sttUnavailable,
    ttsProvider,
    autoContinue,
    setAutoContinue,
    sessionStartTime,
    sessionRemainingMs,
    questionRemainingMs,
    lastScore,
    coachTip,
    submitting,
    muted,
    setMuted,
    dishaCaption,
    liveUserCaption,
    recorder,
    skipSpeaking,
    toggleRecording,
    startHoldRecording,
    stopHoldRecording,
    continueFromFeedback,
    handleTextSubmit,
  } = voice;

  const showRecordingWarning =
    recorder.isRecording && recorder.durationMs >= recorder.warningAtMs;

  const micDisabled =
    submitting ||
    sessionState === "transcribing" ||
    sessionState === "evaluating" ||
    sessionState === "disha_speaking" ||
    sessionState === "loading" ||
    sessionState === "session_timeout" ||
    sessionState === "completed";

  const dishaCaptionLabel =
    sessionState === "feedback"
      ? "DISHA — Feedback"
      : sessionState === "disha_speaking"
        ? "DISHA — Speaking"
        : "DISHA";

  if (sessionState === "loading" && !session) {
    return <LoadingState label="Connecting to interview…" />;
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-2xl p-12">
        <ErrorBanner message={error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/50 bg-white px-6 py-4">
        <div>
          <span className="mb-0.5 block text-label-sm uppercase tracking-widest text-primary">
            {session?.track === "tech" ? "Technical Interview" : "Role Interview"} •{" "}
            {session?.difficulty}
          </span>
          <h1 className="text-headline-md text-on-surface">{session?.target_role}</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/mock-interview/report?session=${sessionId}`)}
          className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-label-md text-secondary transition-colors hover:bg-surface-container-low"
        >
          <Icon name="call_end" size={18} />
          End Call
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <div className="flex flex-1 flex-col gap-6">
          {ttsUnavailable && (
            <div className="rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 px-4 py-3 text-sm text-on-surface">
              Voice playback unavailable — read DISHA&apos;s captions below. You can still record or type
              answers.
            </div>
          )}

          {ttsProvider === "browser" && !ttsUnavailable && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
              Using your browser&apos;s built-in voice as a fallback.
            </div>
          )}

          {ttsProvider === "edge" && !ttsUnavailable && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
              DISHA voice: default neural TTS (no Google Cloud setup required).
            </div>
          )}

          {sttUnavailable && (
            <div className="rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 px-4 py-3 text-sm text-on-surface">
              Speech recognition unavailable — type your answers in text mode.
            </div>
          )}

          {error && (
            <ErrorBanner message={error.message} onRetry={() => setError(null)} />
          )}

          <InterviewStage
            sessionState={sessionState}
            recordingVolume={recorder.volume}
            recordingDurationMs={recorder.durationMs}
          />

          {textMode && !evaluated ? (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <LiveTranscript
                question={currentTurn?.question}
                questionMeta={
                  currentTurn
                    ? `Question ${currentTurn.turn_index} • ${currentTurn.question_type}`
                    : null
                }
                dishaCaption={dishaCaption}
                dishaCaptionLabel={dishaCaptionLabel}
                transcript={textAnswer}
                editable
                onTranscriptChange={setTextAnswer}
                placeholder="Type your answer here…"
              />
              <button
                type="submit"
                disabled={submitting || !textAnswer.trim() || sessionState === "disha_speaking"}
                className="rounded-xl bg-primary px-10 py-4 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60"
              >
                {submitting ? "Evaluating…" : "Submit Answer"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <LiveTranscript
                question={!dishaCaption ? currentTurn?.question : undefined}
                questionMeta={
                  currentTurn && !dishaCaption
                    ? `Question ${currentTurn.turn_index} • ${currentTurn.question_type}`
                    : null
                }
                dishaCaption={dishaCaption || (!evaluated ? currentTurn?.question : undefined)}
                dishaCaptionLabel={dishaCaptionLabel}
                transcript={transcript}
                liveUserCaption={liveUserCaption}
                placeholder={
                  sessionState === "disha_speaking"
                    ? "Wait for DISHA to finish speaking…"
                    : sessionState === "listening"
                      ? "Tap the mic when you're ready to answer…"
                      : "Your answer will appear here…"
                }
              />

              {evaluated && (
                <div className="rounded-xl border-l-4 border-primary bg-primary/5 p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-label-sm font-bold uppercase tracking-wider text-primary">
                      Latest score
                    </span>
                    <span className="text-headline-md font-bold text-primary">
                      {evaluated.score}/10
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface-variant">{evaluated.feedback}</p>
                </div>
              )}

              {!autoContinue && evaluated && (
                <button
                  type="button"
                  onClick={() => continueFromFeedback()}
                  className="rounded-xl bg-primary px-10 py-4 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container"
                >
                  {nextTurn ? "Continue" : "View Report"}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-outline-variant/50 pt-6">
            {!textMode && (
              <MicButton
                sessionState={sessionState}
                isRecording={recorder.isRecording}
                disabled={micDisabled}
                onToggle={toggleRecording}
                onHoldStart={startHoldRecording}
                onHoldEnd={stopHoldRecording}
              />
            )}

            {sessionState === "disha_speaking" && (
              <button
                type="button"
                onClick={skipSpeaking}
                className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-label-md text-secondary hover:bg-surface-container-low"
              >
                <Icon name="skip_next" size={18} />
                Skip
              </button>
            )}

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-label-md text-secondary hover:bg-surface-container-low"
              aria-pressed={muted}
            >
              <Icon name={muted ? "volume_off" : "volume_up"} size={18} />
              {muted ? "Unmute" : "Mute"}
            </button>

            <button
              type="button"
              onClick={() => setTextMode(!textMode)}
              className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-label-md text-secondary hover:bg-surface-container-low"
              aria-pressed={textMode}
            >
              <Icon name="edit_note" size={18} />
              {textMode ? "Voice mode" : "Text mode"}
            </button>
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-72">
          <SessionSidebar
            sessionState={sessionState}
            sessionStartTime={sessionStartTime}
            sessionRemainingMs={sessionRemainingMs}
            questionRemainingMs={questionRemainingMs}
            showCountdown
            lastScore={lastScore}
            coachTip={coachTip}
            currentTurnIndex={currentTurn?.turn_index}
            track={session?.track}
            difficulty={session?.difficulty}
            autoContinue={autoContinue}
            onAutoContinueChange={setAutoContinue}
            showRecordingWarning={showRecordingWarning}
          />
        </div>
      </div>
    </div>
  );
}
