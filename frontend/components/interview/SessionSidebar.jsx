"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

const STATE_LABELS = {
  loading: "Connecting to interview…",
  disha_speaking: "DISHA is speaking…",
  listening: "Your turn — tap mic to answer",
  recording: "Recording your answer…",
  transcribing: "Processing your answer…",
  evaluating: "DISHA is analyzing…",
  feedback: "Feedback ready",
  completed: "Interview complete",
};

function formatElapsed(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PRACTICE_STATE_LABELS = {
  loading: "Loading practice session...",
  disha_speaking: "DISHA Coach is speaking...",
  coding: "Coding active...",
  listening: "Your turn — tap mic to answer",
  recording: "Recording your answer...",
  transcribing: "Processing your answer...",
  evaluating: "DISHA Coach is grading...",
  feedback: "Feedback ready",
  session_timeout: "Time's up!",
  completed: "Session complete",
};

export default function SessionSidebar({
  sessionState,
  sessionStartTime,
  lastScore,
  coachTip,
  currentTurnIndex,
  track,
  difficulty,
  autoContinue,
  onAutoContinueChange,
  showRecordingWarning,
  isPractice = false,
  sessionRemainingMs,
  challengeRemainingMs,
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionStartTime || isPractice) return;
    const tick = () => setElapsed(Date.now() - sessionStartTime);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime, isPractice]);

  const statusLabel = isPractice
    ? (PRACTICE_STATE_LABELS[sessionState] || STATE_LABELS[sessionState] || sessionState)
    : (STATE_LABELS[sessionState] || sessionState);

  const isSessionWarning = isPractice && sessionRemainingMs <= 60000 && sessionRemainingMs > 0;

  return (
    <aside className="flex h-full flex-col gap-5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
      <div>
        <span className="text-label-sm uppercase tracking-widest text-secondary">
          {isPractice ? "Session Time Left" : "Session"}
        </span>
        <p className={`mt-1 font-mono text-headline-md ${isSessionWarning ? "text-error font-bold animate-pulse" : "text-on-surface"}`}>
          {isPractice && sessionRemainingMs !== undefined ? formatElapsed(sessionRemainingMs) : formatElapsed(elapsed)}
        </p>
        {isSessionWarning && (
          <p className="text-xs text-error font-bold mt-1">1 minute left — wrap up practice!</p>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/50 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          {(sessionState === "listening" || sessionState === "recording" || sessionState === "coding") && (
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${sessionState === "coding" ? "bg-primary" : "bg-error"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${sessionState === "coding" ? "bg-primary" : "bg-error"}`} />
            </span>
          )}
          {sessionState === "evaluating" && (
            <Icon name="progress_activity" size={18} className="animate-spin text-primary" />
          )}
          <p className="text-sm font-medium text-on-surface">{statusLabel}</p>
        </div>
        {showRecordingWarning && (
          <p className="text-xs text-tertiary">30 seconds left — wrap up your answer.</p>
        )}
      </div>

      {isPractice && challengeRemainingMs !== undefined && (
        <div className="rounded-xl border border-outline-variant/50 bg-white p-4">
          <span className="text-label-sm uppercase tracking-widest text-secondary block mb-1">Challenge Time Left</span>
          <p className={`font-mono text-headline-md ${challengeRemainingMs <= 30000 && challengeRemainingMs > 0 ? "text-error animate-pulse font-bold" : "text-on-surface"}`}>
            {formatElapsed(challengeRemainingMs)}
          </p>
        </div>
      )}

      {currentTurnIndex != null && (
        <div>
          <span className="text-label-sm uppercase tracking-widest text-secondary">
            {isPractice ? "Challenge" : "Turn"}
          </span>
          <p className="text-body-md text-on-surface">
            {isPractice ? `Challenge ${currentTurnIndex}` : `Question ${currentTurnIndex}`} • {track === "tech" ? "Technical" : "Role"} • {difficulty}
          </p>
        </div>
      )}

      {lastScore != null && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <span className="text-label-sm font-bold uppercase tracking-wider text-primary">
            Last score
          </span>
          <p className="text-headline-lg font-bold text-primary">{lastScore}/10</p>
        </div>
      )}

      {coachTip && sessionState === "feedback" && (
        <div className="flex-1 overflow-auto rounded-xl border border-outline-variant/50 bg-white p-4">
          <span className="mb-2 flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-primary">
            <Icon name="tips_and_updates" size={16} />
            Coach tip
          </span>
          <p className="text-sm leading-relaxed text-on-surface-variant">{coachTip}</p>
        </div>
      )}

      <label className="mt-auto flex cursor-pointer items-center gap-2 text-sm text-secondary">
        <input
          type="checkbox"
          checked={autoContinue}
          onChange={(e) => onAutoContinueChange?.(e.target.checked)}
          className="rounded border-outline-variant text-primary focus:ring-primary"
        />
        Auto-continue after feedback
      </label>
    </aside>
  );
}
