"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { useVoiceInterview } from "@/hooks/useVoiceInterview";
import { ChatBubble } from "@/components/interview/ChatBubble";
import TypingIndicator from "@/components/interview/TypingIndicator";
import Composer from "@/components/interview/Composer";

function formatMs(ms) {
  if (ms == null || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ActiveInterviewPage() {
  const { profileId } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const {
    phase,
    messages,
    error,
    setError,
    composerText,
    setComposerText,
    interimText,
    volume,
    recording,
    micSupported,
    isThinking,
    isSpeaking,
    toggleMic,
    sendText,
    endInterview,
    targetRole,
    sessionRemainingMs,
  } = useVoiceInterview({ sessionId, profileId, router });

  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  if (!sessionId || !profileId) {
    return <LoadingState label="Starting interview…" />;
  }

  if (phase === "loading" && messages.length === 0) {
    return <LoadingState label="Starting interview…" />;
  }

  const busyLabel =
    phase === "completed"
      ? null
      : phase === "transcribing"
        ? "Transcribing…"
        : isSpeaking
          ? "DISHA is speaking…"
          : isThinking
            ? "DISHA is thinking…"
            : null;

  const inputDisabled = phase === "completed" || Boolean(busyLabel);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/50 px-6 py-3">
        <div className="min-w-0">
          <p className="text-label-sm font-semibold uppercase tracking-wider text-primary">Mock interview</p>
          <p className="truncate text-sm text-secondary">{targetRole}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium text-secondary sm:inline">
            {formatMs(sessionRemainingMs)} left
          </span>
          <button
            type="button"
            onClick={endInterview}
            className="rounded-full border border-outline-variant px-4 py-1.5 text-label-sm text-secondary hover:bg-surface-container-low"
          >
            End
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role}
              text={m.text}
              kind={m.kind}
              score={m.score}
            />
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-surface-container-high px-3 py-1">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="shrink-0 border-t border-outline-variant/50 bg-surface pt-3">
        {phase === "completed" ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 pb-4">
            <p className="text-sm font-medium text-secondary">
              Interview complete — your full analysis is in the chat above.
            </p>
            <div className="flex gap-3">
              <Link
                href={`/mock-interview/report?session=${sessionId}`}
                className="rounded-xl bg-primary px-6 py-2.5 text-label-sm font-bold text-on-primary"
              >
                View detailed report
              </Link>
              <Link
                href="/mock-interview"
                className="rounded-xl border border-outline-variant px-6 py-2.5 text-label-sm font-bold text-on-surface"
              >
                Practice again
              </Link>
            </div>
          </div>
        ) : (
          <Composer
            value={composerText}
            onChange={setComposerText}
            onSend={sendText}
            onMicToggle={toggleMic}
            recording={recording}
            micSupported={micSupported}
            volume={volume}
            interimText={interimText}
            disabled={inputDisabled}
            busyLabel={recording ? null : busyLabel}
            placeholder={micSupported ? "Type your answer…" : "Type your answer and press Enter…"}
          />
        )}
      </div>
    </div>
  );
}
