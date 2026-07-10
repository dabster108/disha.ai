"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimum time away from the tab before we consider a resource "studied"
 * enough to prompt for completion. */
const MIN_DWELL_MS = 45_000;

/**
 * Tracks "open a learning resource in a new tab, then come back" so roadmap
 * progress can advance without a blind manual checkbox. Two ways to
 * complete a resource: return to the tab after the minimum dwell time (shows
 * a confirm prompt — safer than a silent auto-tick), or click "Mark done"
 * directly at any time.
 *
 * @param {{ onComplete: (resource: object, source: "auto_open"|"manual") => Promise<void> }} opts
 */
export function useResourceStudyTracker({ onComplete }) {
  const [active, setActive] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const activeRef = useRef(null);
  activeRef.current = active;

  const startTracking = useCallback((resource) => {
    setPendingConfirm(null);
    setActive({ ...resource, startedAt: Date.now() });
  }, []);

  const dismiss = useCallback(() => {
    setActive(null);
    setPendingConfirm(null);
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const current = activeRef.current;
      if (!current) return;
      const elapsed = Date.now() - current.startedAt;
      if (elapsed >= MIN_DWELL_MS) {
        setPendingConfirm(current);
        setActive(null);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const confirmYes = useCallback(async () => {
    if (!pendingConfirm) return;
    await onComplete?.(pendingConfirm, "auto_open");
    setPendingConfirm(null);
  }, [pendingConfirm, onComplete]);

  const confirmNo = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  const markDoneNow = useCallback(async () => {
    if (!active) return;
    await onComplete?.(active, "manual");
    setActive(null);
  }, [active, onComplete]);

  return { active, pendingConfirm, startTracking, dismiss, confirmYes, confirmNo, markDoneNow };
}
