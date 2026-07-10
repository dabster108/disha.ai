"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPracticeSession, submitPractice } from "@/lib/api";
import { usePracticeTimer } from "./usePracticeTimer";

const DURATION_KEY_PREFIX = "disha-practice-duration-";

/** @typedef {'loading'|'ready'|'coding'|'evaluating'|'feedback'|'session_timeout'|'completed'} PracticeState */

export function usePracticeSession({ sessionId, router }) {
  const [sessionState, setSessionState] = useState(/** @type {PracticeState} */ ("loading"));
  const [session, setSession] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [explanation, setExplanation] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);
  const [result, setResult] = useState(null);
  const [nextChallenge, setNextChallenge] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

  const initDoneRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const processingRef = useRef(false);

  const handleSessionExpire = useCallback(() => {
    setSessionState("session_timeout");
  }, []);

  const handleChallengeExpire = useCallback(async () => {
    // Per-challenge timer is a soft nudge, not a forced submit. Only auto-submit
    // when the user actually wrote something; never submit empty answers (which
    // would create fake scores for a challenge they didn't attempt).
    if (sessionState !== "coding" && sessionState !== "ready") return;
    if (challenge?.challenge_type === "coding") {
      if (!code.trim() && !explanation.trim()) return;
      await submitCodingAnswerRef.current?.();
    } else if (challenge?.challenge_type === "scenario") {
      if (!answer.trim()) return;
      await submitScenarioAnswerRef.current?.();
    }
  }, [challenge, sessionState, code, explanation, answer]);

  const timer = usePracticeTimer({
    sessionDurationMinutes,
    challengeCount: session?.skills_selected?.length || 3,
    onSessionExpire: handleSessionExpire,
    onChallengeExpire: handleChallengeExpire,
  });

  const launchChallenge = useCallback(
    (ch) => {
      setChallenge(ch);
      setResult(null);
      setNextChallenge(null);
      setAnswer("");
      setCode(ch.challenge_type === "coding" ? ch.starter_code || "" : "");
      setExplanation("");
      timer.startChallengeTimer();
      timer.resumeTimers();
      setSessionState(ch.challenge_type === "coding" ? "coding" : "ready");
    },
    [timer]
  );

  const init = useCallback(async () => {
    if (!sessionId || initDoneRef.current) return;
    initDoneRef.current = true;
    setSessionState("loading");
    setError(null);

    try {
      const data = await getPracticeSession(sessionId);
      setSession(data);

      const durationData =
        typeof window !== "undefined" ? sessionStorage.getItem(`${DURATION_KEY_PREFIX}${sessionId}`) : null;
      let minutes = 15;
      if (durationData) {
        try {
          minutes = JSON.parse(durationData).minutes;
        } catch {
          /* keep default */
        }
      }
      setSessionDurationMinutes(minutes);

      if (data.status === "completed") {
        setCompletedSummary(data);
        setSessionState("completed");
        return;
      }

      const pending = [...data.challenges]
        .sort((a, b) => a.challenge_index - b.challenge_index)
        .find((c) => c.score == null);

      if (!pending) {
        setCompletedSummary(data);
        setSessionState("completed");
        return;
      }

      const elapsedMs = Date.now() - new Date(data.started_at).getTime();
      const remainingSessionMs = Math.max(0, minutes * 60 * 1000 - elapsedMs);
      if (remainingSessionMs <= 0) {
        setSessionState("session_timeout");
        return;
      }

      timer.setSessionRemainingMs(remainingSessionMs);
      timer.startSessionTimer();
      launchChallenge(pending);
    } catch (err) {
      setError(err);
      setSessionState("ready");
    }
  }, [sessionId, timer, launchChallenge]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const submitAnswer = useCallback(
    async (payloadParts) => {
      if (!sessionId || !challenge || submitting || processingRef.current) return;
      processingRef.current = true;
      setSubmitting(true);
      setError(null);
      setSessionState("evaluating");
      timer.pauseTimers();

      try {
        const res = await submitPractice(sessionId, { challenge_id: challenge.id, ...payloadParts });

        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            challenges: prev.challenges.map((c) =>
              c.id === challenge.id
                ? {
                    ...c,
                    score: res.score,
                    passed: res.passed,
                    verified_skill_level: res.verified_skill_level,
                    feedback: res.feedback,
                  }
                : c
            ),
          };
        });

        setLastScore(res.score);
        setResult(res);

        if (res.session_completed) {
          setPendingSummary(res.session);
          setSessionState("feedback");
          advanceTimerRef.current = setTimeout(() => {
            setCompletedSummary(res.session);
            setSessionState("completed");
          }, 1200);
        } else {
          setNextChallenge(res.next_challenge);
          setSession((prev) => {
            if (!prev) return null;
            const updated = [...prev.challenges];
            if (!updated.some((c) => c.id === res.next_challenge.id)) {
              updated.push(res.next_challenge);
            }
            return { ...prev, challenges: updated };
          });
          setSessionState("feedback");
          advanceTimerRef.current = setTimeout(() => {
            launchChallenge(res.next_challenge);
          }, 1200);
        }
      } catch (err) {
        setError(err);
        setSessionState(challenge.challenge_type === "coding" ? "coding" : "ready");
        timer.resumeTimers();
      } finally {
        setSubmitting(false);
        processingRef.current = false;
      }
    },
    [sessionId, challenge, submitting, timer, launchChallenge]
  );

  const submitCodingAnswerRef = useRef(null);
  const submitCodingAnswer = useCallback(async () => {
    await submitAnswer({ code, explanation });
  }, [code, explanation, submitAnswer]);
  submitCodingAnswerRef.current = submitCodingAnswer;

  const submitScenarioAnswerRef = useRef(null);
  const submitScenarioAnswer = useCallback(async () => {
    await submitAnswer({ answer });
  }, [answer, submitAnswer]);
  submitScenarioAnswerRef.current = submitScenarioAnswer;

  const continueFromFeedback = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    const next = nextChallenge;
    if (!next) {
      if (pendingSummary) setCompletedSummary(pendingSummary);
      setSessionState("completed");
      return;
    }
    launchChallenge(next);
  }, [launchChallenge, nextChallenge, pendingSummary]);

  const getPartialSummary = useCallback(() => {
    if (!session) return null;
    const completedChallenges = session.challenges.filter((c) => c.score != null);
    const overall =
      completedChallenges.length > 0
        ? Math.round(
            (completedChallenges.reduce((sum, c) => sum + c.score, 0) / completedChallenges.length) * 10
          ) / 10
        : 0;
    return {
      overall_score: overall,
      verified_strong_skills: completedChallenges.filter((c) => c.passed).map((c) => c.skill),
      verified_weak_skills: completedChallenges.filter((c) => !c.passed).map((c) => c.skill),
      summary: "Session timed out. Here is your partial summary.",
    };
  }, [session]);

  return {
    sessionState,
    session,
    challenge,
    code,
    setCode,
    explanation,
    setExplanation,
    answer,
    setAnswer,
    error,
    setError,
    lastScore,
    submitting,
    result,
    submitCodingAnswer,
    submitScenarioAnswer,
    continueFromFeedback,
    completedSummary: completedSummary || (sessionState === "session_timeout" ? getPartialSummary() : null),
    timer,
    challengeWarning: timer.challengeRemainingMs <= 30000 && timer.challengeRemainingMs > 0,
    sessionDurationMinutes,
  };
}
