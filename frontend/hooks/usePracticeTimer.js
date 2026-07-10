"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook for managing the overall practice session timer and per-challenge timers.
 * 
 * @param {{
 *   sessionDurationMinutes: number,
 *   challengeCount: number,
 *   onSessionExpire: () => void,
 *   onChallengeExpire: () => void,
 *   initialSessionRemainingMs?: number | null
 * }} params
 */
export function usePracticeTimer({
  sessionDurationMinutes,
  challengeCount,
  onSessionExpire,
  onChallengeExpire,
  initialSessionRemainingMs = null,
}) {
  const [sessionRemainingMs, setSessionRemainingMs] = useState(
    initialSessionRemainingMs !== null
      ? initialSessionRemainingMs
      : sessionDurationMinutes * 60 * 1000
  );

  const challengeDurationMs = Math.max(2, Math.floor(sessionDurationMinutes / challengeCount)) * 60 * 1000;
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(challengeDurationMs);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isChallengeActive, setIsChallengeActive] = useState(false);

  const onSessionExpireRef = useRef(onSessionExpire);
  const onChallengeExpireRef = useRef(onChallengeExpire);

  useEffect(() => {
    onSessionExpireRef.current = onSessionExpire;
    onChallengeExpireRef.current = onChallengeExpire;
  }, [onSessionExpire, onChallengeExpire]);

  const intervalRef = useRef(null);

  const startSessionTimer = useCallback(() => {
    setIsSessionActive(true);
  }, []);

  const startChallengeTimer = useCallback(() => {
    setChallengeRemainingMs(challengeDurationMs);
    setIsChallengeActive(true);
  }, [challengeDurationMs]);

  const pauseTimers = useCallback(() => {
    setIsSessionActive(false);
    setIsChallengeActive(false);
  }, []);

  const resumeTimers = useCallback(() => {
    setIsSessionActive(true);
    setIsChallengeActive(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (isSessionActive) {
        setSessionRemainingMs((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            setIsSessionActive(false);
            setIsChallengeActive(false);
            onSessionExpireRef.current?.();
            return 0;
          }
          return next;
        });
      }

      if (isChallengeActive) {
        setChallengeRemainingMs((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            setIsChallengeActive(false);
            onChallengeExpireRef.current?.();
            return 0;
          }
          return next;
        });
      }
    };

    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSessionActive, isChallengeActive]);

  return {
    sessionRemainingMs,
    challengeRemainingMs,
    setSessionRemainingMs,
    setChallengeRemainingMs,
    startSessionTimer,
    startChallengeTimer,
    pauseTimers,
    resumeTimers,
  };
}
