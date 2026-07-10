"use client";

import { memo } from "react";

function JourneyRingBase({ pct = 0, completedCount = 0, totalSteps = 6, readinessScore = null }) {
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
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
            className="text-primary transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-headline-md font-bold text-on-surface">{pct}%</span>
          <span className="text-[10px] uppercase tracking-wider text-secondary">Journey</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-label-md font-bold text-on-surface">
          {completedCount} of {totalSteps} steps complete
        </p>
        {readinessScore != null && (
          <p className="mt-1 text-sm text-secondary">
            Market readiness: <span className="font-bold text-primary">{readinessScore}%</span>
          </p>
        )}
        <p className="mt-2 text-xs text-secondary">
          Profile → Gap → Interview → Practice → Roadmap → Jobs
        </p>
      </div>
    </div>
  );
}

export default memo(JourneyRingBase);
