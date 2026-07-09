"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { useVoiceInterview } from "@/hooks/useVoiceInterview";
import MicButton from "@/components/interview/MicButton";
import SessionSidebar from "@/components/interview/SessionSidebar";

const STATUS_TEXT = {
  loading: "Connecting…",
  disha_speaking: "DISHA is speaking…",
  listening: "Your turn — tap the mic when ready",
  recording: "Recording — auto-submits when you pause",
  transcribing: "Transcribing your answer…",
  evaluating: "DISHA is thinking…",
  feedback: "Feedback ready",
  session_timeout: "Time's up",
  completed: "Interview complete",
};

function ChatBubble({ message }) {
  const isDisha = message.role === "disha";
  return (
    <div className={`flex ${isDisha ? "justify-start" : "justify-end"}`}>
      <div className={`flex max-w-[85%] items-end gap-2.5 sm:max-w-[70%] ${isDisha ? "flex-row" : "flex-row-reverse"}`}>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isDisha ? "bg-primary/15 text-primary" : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          <Icon name={isDisha ? "smart_toy" : "person"} size={18} />
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-body-md leading-relaxed ${
            isDisha
              ? message.kind === "feedback"
                ? "border border-primary/20 bg-primary/5 text-on-surface"
                : "bg-surface-container-low text-on-surface"
              : "bg-primary text-on-primary"
          }`}
        >
          {message.kind === "feedback" && message.score != null && (
            <span className="mb-1 block text-label-sm font-bold uppercase tracking-wide text-primary">
              Score {message.score}/10
            </span>
          )}
          <p className="whitespace-pre-line">{message.text}</p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-end gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon name="smart_toy" size={18} />
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-surface-container-low px-4 py-3.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary" />
        </div>
      </div>
    </div>
  );
}

export default function ActiveInterviewPage() {
  const { profileId } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const voice = useVoiceInterview({ sessionId, profileId, router });

  const {
    sessionState,
    session,
    evaluated,
    nextTurn,
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
    submitting,
    muted,
    setMuted,
    messages,
    recorder,
    skipSpeaking,
    toggleRecording,
    continueFromFeedback,
    handleTextSubmit,
  } = voice;

  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sessionState]);

  const showRecordingWarning = recorder.isRecording && recorder.durationMs >= recorder.warningAtMs;

  const micDisabled =
    submitting ||
    sessionState === "transcribing" ||
    sessionState === "evaluating" ||
    sessionState === "disha_speaking" ||
    sessionState === "loading" ||
    sessionState === "session_timeout" ||
    sessionState === "completed";

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
            {session?.track === "tech" ? "Technical Interview" : "Role Interview"} • {session?.difficulty}
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
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant/50 bg-white px-5 py-3">
            <span
              className={`relative flex h-2.5 w-2.5 shrink-0 ${
                sessionState === "recording" || sessionState === "listening" ? "" : ""
              }`}
            >
              {(sessionState === "recording" || sessionState === "disha_speaking") && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  sessionState === "recording"
                    ? "bg-error"
                    : sessionState === "disha_speaking"
                      ? "bg-primary"
                      : "bg-outline-variant"
                }`}
              />
            </span>
            <p className="text-sm font-medium text-on-surface">{STATUS_TEXT[sessionState] || sessionState}</p>
            {sessionState === "disha_speaking" && (
              <button
                type="button"
                onClick={skipSpeaking}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-secondary hover:bg-surface-container-low"
              >
                <Icon name="skip_next" size={16} />
                Skip
              </button>
            )}
          </div>

          {(ttsUnavailable || sttUnavailable || ttsProvider === "browser" || ttsProvider === "edge" || error) && (
            <div className="space-y-2 border-b border-outline-variant/50 bg-white px-5 py-3">
              {ttsUnavailable && (
                <div className="rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 px-4 py-2.5 text-sm text-on-surface">
                  Voice playback unavailable — read DISHA&apos;s messages below. You can still record or type answers.
                </div>
              )}
              {ttsProvider === "browser" && !ttsUnavailable && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-on-surface">
                  Using your browser&apos;s built-in voice as a fallback.
                </div>
              )}
              {ttsProvider === "edge" && !ttsUnavailable && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-on-surface">
                  DISHA voice: default neural TTS (no Google Cloud setup required).
                </div>
              )}
              {sttUnavailable && (
                <div className="rounded-xl border border-tertiary/30 bg-tertiary-fixed/20 px-4 py-2.5 text-sm text-on-surface">
                  Speech recognition unavailable — type your answers in text mode.
                </div>
              )}
              {error && <ErrorBanner message={error.message} onRetry={() => setError(null)} />}
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {sessionState === "evaluating" && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {!autoContinue && evaluated && sessionState === "feedback" && (
            <div className="flex justify-center border-t border-outline-variant/50 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => continueFromFeedback()}
                className="rounded-xl bg-primary px-8 py-3 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container"
              >
                {nextTurn ? "Continue" : "View Report"}
              </button>
            </div>
          )}

          <div className="border-t border-outline-variant/50 bg-white p-4">
            {textMode ? (
              <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Message DISHA…"
                  disabled={submitting || sessionState === "disha_speaking"}
                  className="flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={submitting || !textAnswer.trim() || sessionState === "disha_speaking"}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-all hover:bg-primary-container disabled:opacity-50"
                  aria-label="Send"
                >
                  <Icon name="send" size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setTextMode(false)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-outline-variant text-secondary hover:bg-surface-container-low"
                  aria-label="Switch to voice mode"
                >
                  <Icon name="mic" size={20} />
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <MicButton
                  sessionState={sessionState}
                  isRecording={recorder.isRecording}
                  disabled={micDisabled}
                  onToggle={toggleRecording}
                />
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
                  onClick={() => setTextMode(true)}
                  className="flex items-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-label-md text-secondary hover:bg-surface-container-low"
                >
                  <Icon name="edit_note" size={18} />
                  Text mode
                </button>
                {showRecordingWarning && (
                  <p className="w-full text-center text-xs font-bold text-error">30 seconds left — wrap up your answer.</p>
                )}
              </div>
            )}
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
            currentTurnIndex={messages.filter((m) => m.kind === "question").length}
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
