"use client";

import { useEffect, useRef } from "react";
import { Mic, Square, ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Waveform } from "./Waveform";

/**
 * Claude-style unified composer: one rounded field shared by text and voice.
 *  - Idle: type an answer or tap the mic.
 *  - Recording: shows a live waveform + interim transcript; auto-sends on pause.
 *  - Busy (transcribing/thinking/speaking): input disabled with a status hint.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  onMicToggle,
  recording = false,
  micSupported = true,
  volume = 0,
  interimText = "",
  disabled = false,
  busyLabel = null,
  placeholder = "Type your answer…",
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;
  const showWaveform = recording;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div
        className={cn(
          "flex items-end gap-2 rounded-3xl border bg-surface-container-lowest p-2 shadow-sm transition-colors",
          recording ? "border-primary/50 ring-2 ring-primary/15" : "border-outline-variant"
        )}
      >
        {micSupported && (
          <button
            type="button"
            onClick={onMicToggle}
            disabled={disabled && !recording}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-40",
              recording
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface hover:bg-surface-container"
            )}
          >
            {recording ? (
              <>
                <span className="absolute h-11 w-11 animate-ping rounded-full bg-primary/20" />
                <Square className="relative h-4 w-4 fill-current" />
              </>
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}

        <div className="flex min-h-[44px] flex-1 flex-col justify-center px-1 py-1.5">
          {showWaveform ? (
            <div className="flex items-center gap-3">
              <Waveform volume={volume} active className="shrink-0" />
              <span className="line-clamp-2 text-body-md text-on-surface">
                {interimText || "Listening…"}
              </span>
            </div>
          ) : busyLabel ? (
            <span className="flex items-center gap-2 text-body-md text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {busyLabel}
            </span>
          ) : (
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              className="w-full resize-none bg-transparent text-body-md text-on-surface placeholder:text-secondary focus:outline-none disabled:opacity-60"
            />
          )}
        </div>

        <button
          type="button"
          onClick={recording ? onMicToggle : onSend}
          disabled={!recording && !canSend}
          aria-label={recording ? "Send now" : "Send answer"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-40",
            recording || canSend
              ? "bg-primary text-on-primary hover:bg-primary/90"
              : "bg-surface-container-high text-secondary"
          )}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-secondary">
        {recording
          ? "Speak now — your response will be sent automatically when you pause."
          : micSupported
            ? "Tap the mic to speak, or type your answer."
            : "Type your answer and press Enter."}
      </p>
    </div>
  );
}
