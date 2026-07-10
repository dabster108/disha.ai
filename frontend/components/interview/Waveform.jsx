"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/** Lightweight mic-input waveform. Heights derive from the current volume (0..1). */
function WaveformBase({ volume = 0, active = false, className }) {
  const bars = [0.45, 0.75, 1, 0.7, 0.4];
  return (
    <div className={cn("flex h-6 items-center gap-1", className)} aria-hidden="true">
      {bars.map((weight, i) => {
        const height = active ? Math.max(0.15, Math.min(1, volume * weight * 3.2)) : 0.15;
        return (
          <span
            key={i}
            className={cn(
              "w-1 rounded-full transition-[height] duration-75",
              active ? "bg-primary" : "bg-outline-variant"
            )}
            style={{ height: `${height * 100}%` }}
          />
        );
      })}
    </div>
  );
}

export const Waveform = memo(WaveformBase);
