"use client";

import { useCallback } from "react";
import Icon from "@/components/ui/Icon";

export default function MicButton({
  sessionState,
  isRecording,
  disabled = false,
  onToggle,
  onHoldStart,
  onHoldEnd,
}) {
  const canRecord = sessionState === "listening" || sessionState === "recording";
  const isDisabled = disabled || !canRecord;

  const handleKeyDown = useCallback(
    (e) => {
      if (e.code === "Space" && !isDisabled) {
        e.preventDefault();
        if (!isRecording) onHoldStart?.();
      }
    },
    [isDisabled, isRecording, onHoldStart]
  );

  const handleKeyUp = useCallback(
    (e) => {
      if (e.code === "Space" && isRecording) {
        e.preventDefault();
        onHoldEnd?.();
      }
    },
    [isRecording, onHoldEnd]
  );

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-pressed={isRecording}
      aria-label={isRecording ? "Stop recording" : "Start recording answer"}
      className={`flex items-center gap-3 rounded-full px-8 py-4 text-label-md font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        isRecording
          ? "bg-error text-on-error animate-pulse shadow-lg shadow-error/30"
          : "bg-primary text-on-primary shadow-lg shadow-primary/20 hover:bg-primary-container"
      }`}
    >
      <Icon name={isRecording ? "stop_circle" : "mic"} size={22} filled={isRecording} />
      {isRecording ? "Finish answer" : "Restart mic"}
    </button>
  );
}
