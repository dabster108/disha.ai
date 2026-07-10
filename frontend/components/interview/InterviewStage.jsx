"use client";

import Icon from "@/components/ui/Icon";
import SpeakingWaveform from "./SpeakingWaveform";

function ParticipantPanel({ label, sublabel, icon, active, volume = 0, speaking = false, variant = "disha" }) {
  const isDisha = variant === "disha";
  const bg = isDisha
    ? "bg-gradient-to-br from-primary/10 via-surface-container-low to-primary-fixed/40"
    : "bg-gradient-to-br from-surface-container-low to-surface-container";

  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/60 p-6 ${bg}`}
    >
      <div
        className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all ${
          speaking
            ? "border-primary bg-primary/15 shadow-lg shadow-primary/20"
            : active
              ? "border-tertiary bg-tertiary-fixed/30"
              : "border-outline-variant bg-white/80"
        }`}
      >
        {speaking || active ? (
          <SpeakingWaveform active={speaking || active} bars={7} color={isDisha ? "bg-primary" : "bg-tertiary"} />
        ) : (
          <Icon name={icon} size={48} className={isDisha ? "text-primary" : "text-secondary"} />
        )}
      </div>

      {active && !speaking && volume > 0.05 && (
        <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-tertiary transition-all"
              style={{ height: `${4 + volume * 28 * (0.5 + Math.sin(i) * 0.5)}px` }}
            />
          ))}
        </div>
      )}

      <p className="text-label-md font-bold text-on-surface">{label}</p>
      <p className="text-sm text-secondary">{sublabel}</p>
    </div>
  );
}

export default function InterviewStage({
  sessionState,
  recordingVolume = 0,
  recordingDurationMs = 0,
}) {
  const dishaSpeaking = sessionState === "disha_speaking";
  const recording = sessionState === "recording";
  const listening = sessionState === "listening";

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ParticipantPanel
        label="AI Interviewer (DISHA)"
        sublabel={dishaSpeaking ? "Speaking…" : "Ready"}
        icon="smart_toy"
        variant="disha"
        speaking={dishaSpeaking}
      />
      <ParticipantPanel
        label="You (Live)"
        sublabel={
          recording
            ? `Recording ${formatDuration(recordingDurationMs)}`
            : listening
              ? "Your turn"
              : "Listening"
        }
        icon="person"
        variant="user"
        active={recording || listening}
        volume={recordingVolume}
      />
    </div>
  );
}
