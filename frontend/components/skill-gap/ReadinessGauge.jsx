"use client";

import { useEffect, useState } from "react";

/**
 * Readiness ring — animates from 0 to the score on first mount, and smoothly
 * re-animates to a new score after a re-run (same element, no remount). The
 * two-step render (paint at 0, then RAF to target) is what makes the CSS
 * transition fire on mount instead of snapping straight to the final value.
 */
export default function ReadinessGauge({ score, size = 160, stroke = 10, className = "" }) {
  const target = Math.max(0, Math.min(100, score ?? 0));
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayPct(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPct / 100) * circumference;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Readiness ${target} percent`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-display-lg font-bold leading-none text-on-surface">{target}%</span>
        <span className="mt-1.5 text-[10px] uppercase tracking-wider text-secondary">Ready</span>
      </div>
    </div>
  );
}
