"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPracticeSession,
  submitPractice,
  transcribeAudio,
  ApiError,
} from "@/lib/api";
import { useAudioRecorder } from "./useAudioRecorder";
import { useTtsPlayer } from "./useTtsPlayer";
import { usePracticeTimer } from "./usePracticeTimer";

const TEXT_MODE_KEY = "disha-practice-text-mode";
const DURATION_KEY_PREFIX = "disha-practice-duration-";

/** 
 * @typedef {'loading'|'disha_speaking'|'coding'|'listening'|'recording'|'transcribing'|'evaluating'|'feedback'|'session_timeout'|'completed'} PracticeState 
 */

export function useVoicePractice({ sessionId, profileId, router }) {
  const [sessionState, setSessionState] = useState(/** @type {PracticeState} */ ("loading"));
  const [session, setSession] = useState(null);
  const [challenge, setChallenge] = useState(null);
  
  const [code, setCode] = useState("");
  const [explanation, setExplanation] = useState("");
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState("");
  
  const [textMode, setTextModeState] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [error, setError] = useState(null);
  
  const [lastScore, setLastScore] = useState(null);
  const [coachTip, setCoachTip] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);
  
  const [result, setResult] = useState(null);
  const [nextChallenge, setNextChallenge] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

  const initDoneRef = useRef(false);
  const advanceTimerRef = useRef(null);

  const recorder = useAudioRecorder();
  const ttsPlayer = useTtsPlayer();

  const handleSessionExpire = useCallback(() => {
    recorder.cleanup();
    ttsPlayer.abortSpeaking();
    setSessionState("session_timeout");
  }, [recorder, ttsPlayer]);

  const handleChallengeExpire = useCallback(async () => {
    // Only coding challenges automatically submit on expire
    if (challenge && challenge.challenge_type === "coding" && sessionState === "coding") {
      await submitCodingAnswer();
    }
  }, [challenge, sessionState]);

  const timer = usePracticeTimer({
    sessionDurationMinutes,
    challengeCount: session?.skills_selected?.length || 3,
    onSessionExpire: handleSessionExpire,
    onChallengeExpire: handleChallengeExpire,
  });

  const launchChallenge = useCallback(async (ch, preferTextMode = textMode) => {
    setChallenge(ch);
    setResult(null);
    setNextChallenge(null);
    setTranscript("");
    setAnswer("");
    setCode(ch.challenge_type === "coding" ? ch.starter_code || "" : "");
    setExplanation("");

    timer.startChallengeTimer();
    timer.resumeTimers();

    if (ch.challenge_type === "coding") {
      setSessionState("coding");
      if (!preferTextMode && !ttsPlayer.ttsUnavailable) {
        await ttsPlayer.playTts(`Coding challenge for ${ch.skill}. ${ch.prompt.split("\n")[0] || ""}`, preferTextMode);
      }
    } else {
      if (!preferTextMode && !ttsPlayer.ttsUnavailable) {
        setSessionState("disha_speaking");
        await ttsPlayer.playTts(ch.prompt, preferTextMode);
        setSessionState((prev) => (prev === "disha_speaking" ? "listening" : prev));
      } else {
        setSessionState("listening");
      }
    }
  }, [textMode, ttsPlayer, timer]);

  const init = useCallback(async () => {
    if (!sessionId || initDoneRef.current) return;
    setSessionState("loading");
    setError(null);

    try {
      const storedTextMode =
        typeof window !== "undefined" && sessionStorage.getItem(TEXT_MODE_KEY) === "true";
      if (storedTextMode) setTextModeState(true);

      const data = await getPracticeSession(sessionId);
      setSession(data);

      const durationData = typeof window !== "undefined" ? sessionStorage.getItem(`${DURATION_KEY_PREFIX}${sessionId}`) : null;
      let minutes = 15;
      if (durationData) {
        try {
          minutes = JSON.parse(durationData).minutes;
        } catch {}
      }
      setSessionDurationMinutes(minutes);

      if (data.status === "completed") {
        setCompletedSummary(data);
        setSessionState("completed");
        initDoneRef.current = true;
        return;
      }

      const pending = [...data.challenges]
        .sort((a, b) => a.challenge_index - b.challenge_index)
        .find((c) => c.score == null);

      if (!pending) {
        setCompletedSummary(data);
        setSessionState("completed");
        initDoneRef.current = true;
        return;
      }

      initDoneRef.current = true;

      // Start timers based on started_at
      const elapsedMs = Date.now() - new Date(data.started_at).getTime();
      const totalSessionMs = minutes * 60 * 1000;
      const remainingSessionMs = Math.max(0, totalSessionMs - elapsedMs);

      if (remainingSessionMs <= 0) {
        setSessionState("session_timeout");
        return;
      }

      timer.setSessionRemainingMs(remainingSessionMs);
      timer.startSessionTimer();

      await launchChallenge(pending, storedTextMode);
    } catch (err) {
      setError(err);
      setSessionState("listening");
    }
  }, [sessionId, timer, launchChallenge]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return () => {
      ttsPlayer.abortSpeaking();
      recorder.cleanup();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [ttsPlayer, recorder]);

  const setTextMode = useCallback((value) => {
    setTextModeState(value);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TEXT_MODE_KEY, value ? "true" : "false");
    }
    if (value) {
      ttsPlayer.abortSpeaking();
      if (sessionState === "disha_speaking") {
        setSessionState("listening");
      }
    }
  }, [ttsPlayer, sessionState]);

  const submitAnswer = useCallback(async (payloadParts) => {
    if (!sessionId || !challenge || submitting) return;
    
    // Stop recording and abort TTS if running
    recorder.cleanup();
    ttsPlayer.abortSpeaking();

    setSubmitting(true);
    setError(null);
    setSessionState("evaluating");
    timer.pauseTimers();

    try {
      const payload = {
        challenge_id: challenge.id,
        ...payloadParts,
      };
      const res = await submitPractice(sessionId, payload);

      // Mutate local session challenges array so partial summaries stay accurate
      setSession((prev) => {
        if (!prev) return null;
        const updatedChallenges = prev.challenges.map((c) =>
          c.id === challenge.id
            ? {
                ...c,
                score: res.score,
                passed: res.passed,
                verified_skill_level: res.verified_skill_level,
                feedback: res.feedback,
              }
            : c
        );
        return { ...prev, challenges: updatedChallenges };
      });

      setLastScore(res.score);
      setCoachTip(res.feedback);
      setResult(res);

      if (res.session_completed) {
        setPendingSummary(res.session);
        setSessionState("feedback");

        if (!textMode && !ttsPlayer.ttsUnavailable && !ttsPlayer.muted) {
          const feedbackText = `Score ${res.score} out of 10. ${res.feedback}`;
          await ttsPlayer.playTts(feedbackText, textMode);
        }

        if (autoContinue) {
          advanceTimerRef.current = setTimeout(() => {
            setCompletedSummary(res.session);
            setSessionState("completed");
          }, 1500);
        }
      } else {
        setNextChallenge(res.next_challenge);
        setSessionState("feedback");

        // Dynamically add a new challenge to the local session state
        setSession((prev) => {
          if (!prev) return null;
          const updated = [...prev.challenges];
          if (!updated.some((c) => c.id === res.next_challenge.id)) {
            updated.push(res.next_challenge);
          }
          return { ...prev, challenges: updated };
        });

        if (!textMode && !ttsPlayer.ttsUnavailable && !ttsPlayer.muted) {
          const feedbackText = `Score ${res.score} out of 10. ${res.feedback}`;
          await ttsPlayer.playTts(feedbackText, textMode);
        }

        if (autoContinue) {
          advanceTimerRef.current = setTimeout(() => {
            continueFromFeedback(res.next_challenge);
          }, 1000);
        }
      }
    } catch (err) {
      setError(err);
      setSessionState(challenge.challenge_type === "coding" ? "coding" : "listening");
      timer.resumeTimers();
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, challenge, textMode, ttsPlayer, autoContinue, submitting, timer, recorder]);

  const submitCodingAnswer = useCallback(async (codeOverride = null, explanationOverride = null) => {
    const finalCode = codeOverride ?? code;
    const finalExplanation = explanationOverride ?? explanation;
    await submitAnswer({ code: finalCode, explanation: finalExplanation });
  }, [code, explanation, submitAnswer]);

  const submitTextScenarioAnswer = useCallback(async (answerText = null) => {
    const finalAnswer = answerText ?? answer;
    await submitAnswer({ answer: finalAnswer });
  }, [answer, submitAnswer]);

  const continueFromFeedback = useCallback(async (chOverride = null) => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const nextCh = chOverride ?? nextChallenge;
    if (!nextCh) {
      if (pendingSummary) {
        setCompletedSummary(pendingSummary);
      }
      setSessionState("completed");
      return;
    }

    await launchChallenge(nextCh);
  }, [nextChallenge, pendingSummary, launchChallenge]);

  const submitVoiceAnswer = useCallback(async (blob) => {
    setSessionState("transcribing");
    setError(null);
    try {
      const { transcript: sttText } = await transcribeAudio(blob);
      if (!sttText?.trim()) {
        setError(new Error("Couldn't hear you — try again."));
        setSessionState("listening");
        return;
      }
      setTranscript(sttText);
      await submitAnswer({ answer: sttText });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(new Error("Couldn't hear you — try again."));
        setSessionState("listening");
      } else {
        setError(err);
        setSessionState("listening");
      }
    }
  }, [submitAnswer]);

  const toggleRecording = useCallback(async () => {
    if (sessionState !== "listening" && sessionState !== "recording") return;
    if (recorder.error) {
      setTextMode(true);
      setError(recorder.error);
      return;
    }

    if (recorder.isRecording) {
      setSessionState("transcribing");
      const blobPromise = recorder.stopRecording();
      const blob = await blobPromise;
      if (blob && blob.size > 0) {
        await submitVoiceAnswer(blob);
      } else {
        setError(new Error("Recording was empty — try again."));
        setSessionState("listening");
      }
    } else {
      try {
        setSessionState("recording");
        await recorder.startRecording();
      } catch {
        setTextMode(true);
        setSessionState("listening");
      }
    }
  }, [recorder, sessionState, setTextMode, submitVoiceAnswer]);

  const startHoldRecording = useCallback(async () => {
    if (sessionState !== "listening" || recorder.isRecording) return;
    try {
      setSessionState("recording");
      await recorder.startRecording();
    } catch {
      setTextMode(true);
      setSessionState("listening");
    }
  }, [recorder, sessionState, setTextMode]);

  const stopHoldRecording = useCallback(async () => {
    if (!recorder.isRecording) return;
    setSessionState("transcribing");
    const blob = await recorder.stopRecording();
    if (blob && blob.size > 0) {
      await submitVoiceAnswer(blob);
    } else {
      setError(new Error("Recording was empty — try again."));
      setSessionState("listening");
    }
  }, [recorder, submitVoiceAnswer]);

  const skipSpeaking = useCallback(() => {
    ttsPlayer.abortSpeaking();
    if (sessionState === "disha_speaking") {
      setSessionState("listening");
    }
  }, [ttsPlayer, sessionState]);

  const getPartialSummary = useCallback(() => {
    if (!session) return null;
    const completedChallenges = session.challenges.filter((c) => c.score != null);
    const overall = completedChallenges.length > 0
      ? Math.round((completedChallenges.reduce((sum, c) => sum + c.score, 0) / completedChallenges.length) * 10) / 10
      : 0;
    const strong = completedChallenges.filter((c) => c.passed).map((c) => c.skill);
    const weak = completedChallenges.filter((c) => !c.passed).map((c) => c.skill);

    return {
      overall_score: overall,
      verified_strong_skills: strong,
      verified_weak_skills: weak,
      summary: "Session timed out! Here is the summary of the challenges you managed to complete.",
    };
  }, [session]);

  const challengeWarning = timer.challengeRemainingMs <= 30000 && timer.challengeRemainingMs > 0;
  const sessionWarning = timer.sessionRemainingMs <= 60000 && timer.sessionRemainingMs > 0;

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
    transcript,
    error,
    setError,
    textMode,
    setTextMode,
    autoContinue,
    setAutoContinue,
    lastScore,
    coachTip,
    submitting,
    muted: ttsPlayer.muted,
    setMuted: ttsPlayer.setMuted,
    ttsUnavailable: ttsPlayer.ttsUnavailable,
    recorder,
    playTts: ttsPlayer.playTts,
    abortSpeaking: ttsPlayer.abortSpeaking,
    skipSpeaking,
    toggleRecording,
    startHoldRecording,
    stopHoldRecording,
    continueFromFeedback,
    submitCodingAnswer,
    submitTextScenarioAnswer,
    completedSummary: completedSummary || (sessionState === "session_timeout" ? getPartialSummary() : null),
    timer,
    challengeWarning,
    sessionWarning,
    result,
  };
}
