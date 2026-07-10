"use client";

import React from "react";

/**
 * A reusable visual countdown bar for challenges.
 * 
 * @param {{
 *   remainingMs: number,
 *   totalMs: number,
 *   warningMs?: number
 * }} params
 */
export default function ChallengeTimer({ remainingMs, totalMs, warningMs = 30000 }) {
  const percentage = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const formatTime = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isLow = remainingMs <= warningMs;

  return (
    <div className="w-full space-y-1.5" aria-live={isLow ? "assertive" : "off"}>
      <div className="flex items-center justify-between text-label-sm">
        <span className="text-secondary font-medium">Time Left on Challenge</span>
        <span className={`font-mono text-body-md font-bold ${isLow ? "text-error" : "text-primary"}`}>
          {formatTime(remainingMs)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full transition-all duration-1000 rounded-full ${
            isLow ? "bg-error animate-pulse" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
