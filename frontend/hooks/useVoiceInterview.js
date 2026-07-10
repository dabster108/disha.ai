"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerInterview,
  getInterviewHistory,
  transcribeAudio,
  ApiError,
} from "@/lib/api";
import { useAudioRecorder } from "./useAudioRecorder";
import { useTtsPlayer } from "./useTtsPlayer";

const TEXT_MODE_KEY = "disha-interview-text-mode";
const WELCOME_KEY_PREFIX = "disha-interview-welcome-";

/** @typedef {'loading'|'disha_speaking'|'listening'|'recording'|'transcribing'|'evaluating'|'feedback'|'completed'} SessionState */

/**
 * Voice-first interview session state machine.
 * @param {{ sessionId: string | null, profileId: string | null, router: import('next/navigation').AppRouterInstance }} opts
 */
export function useVoiceInterview({ sessionId, profileId, router }) {
  const [sessionState, setSessionState] = useState(/** @type {SessionState} */ ("loading"));
  const [session, setSession] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [evaluated, setEvaluated] = useState(null);
  const [nextTurn, setNextTurn] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [error, setError] = useState(null);
  const [textMode, setTextModeState] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  const [coachTip, setCoachTip] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ttsPlayer = useTtsPlayer();
  const ttsUnavailable = ttsPlayer.ttsUnavailable;
  const muted = ttsPlayer.muted;

  const initDoneRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const continueFromFeedbackRef = useRef(null);

  const recorder = useAudioRecorder();

  const abortSpeaking = ttsPlayer.abortSpeaking;

  const playTts = useCallback(
    async (text) => {
      if (!text?.trim() || textMode || ttsPlayer.ttsUnavailable || ttsPlayer.muted) return false;

      setSessionState("disha_speaking");
      return await ttsPlayer.playTts(text, textMode);
    },
    [textMode, ttsPlayer]
  );

  const speakThenListen = useCallback(
    async (text) => {
      await playTts(text);
      setSessionState("listening");
    },
    [playTts]
  );

  const loadSession = useCallback(async () => {
    if (!sessionId || !profileId) return null;
    const sessions = await getInterviewHistory(profileId);
    const found = sessions.find((s) => s.id === sessionId);
    if (!found) throw new Error("Interview session not found.");
    if (found.status === "completed") {
      router.replace(`/mock-interview/report?session=${sessionId}`);
      return null;
    }
    const pending = [...found.turns]
      .sort((a, b) => a.turn_index - b.turn_index)
      .find((t) => t.answer == null);
    return { session: found, currentTurn: pending || null };
  }, [sessionId, profileId, router]);

  const runInitialFlow = useCallback(
    async (foundSession, pendingTurn, preferTextMode) => {
      if (!pendingTurn) {
        router.replace(`/mock-interview/report?session=${sessionId}`);
        return;
      }

      const answeredCount = foundSession.turns.filter((t) => t.answer != null).length;
      const isFresh = answeredCount === 0 && pendingTurn.turn_index === 1;
      const welcomeKey = `${WELCOME_KEY_PREFIX}${sessionId}`;
      const welcomeRaw = typeof window !== "undefined" ? sessionStorage.getItem(welcomeKey) : null;

      if (isFresh && welcomeRaw && !preferTextMode && !ttsUnavailable) {
        try {
          const { welcome_message } = JSON.parse(welcomeRaw);
          sessionStorage.removeItem(welcomeKey);
          if (welcome_message) {
            await playTts(welcome_message);
          }
        } catch {
          // ignore malformed storage
        }
      }

      if (!preferTextMode && !ttsUnavailable) {
        await speakThenListen(pendingTurn.question);
      } else {
        setSessionState("listening");
      }
    },
    [playTts, router, sessionId, speakThenListen, ttsUnavailable]
  );

  const init = useCallback(async () => {
    if (!sessionId || !profileId || initDoneRef.current) return;
    setSessionState("loading");
    setError(null);

    try {
      const storedTextMode =
        typeof window !== "undefined" && sessionStorage.getItem(TEXT_MODE_KEY) === "true";
      if (storedTextMode) setTextModeState(true);

      const data = await loadSession();
      if (!data) return;

      setSession(data.session);
      setCurrentTurn(data.currentTurn);
      setSessionStartTime(new Date(data.session.started_at).getTime());
      initDoneRef.current = true;

      await runInitialFlow(data.session, data.currentTurn, storedTextMode);
    } catch (err) {
      setError(err);
      setSessionState("listening");
    }
  }, [loadSession, profileId, runInitialFlow, sessionId]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    return () => {
      abortSpeaking();
      recorder.cleanup();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [abortSpeaking, recorder]);

  const setTextMode = useCallback((value) => {
    setTextModeState(value);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TEXT_MODE_KEY, value ? "true" : "false");
    }
    if (value) abortSpeaking();
    if (value && sessionState === "disha_speaking") {
      setSessionState("listening");
    }
  }, [abortSpeaking, sessionState]);

  const submitAnswer = useCallback(
    async (answerText) => {
      if (!answerText?.trim() || !sessionId) return;
      setSubmitting(true);
      setError(null);
      setSessionState("evaluating");

      try {
        const result = await answerInterview(sessionId, answerText.trim());
        setEvaluated(result.evaluated_turn);
        setLastScore(result.evaluated_turn.score);
        setCoachTip(result.evaluated_turn.feedback);
        setTranscript(answerText.trim());

        if (result.interview_completed) {
          setNextTurn(null);
          setSessionState("feedback");

          if (!textMode && !ttsUnavailable && !muted) {
            const feedbackText = `Score ${result.evaluated_turn.score} out of 10. ${result.evaluated_turn.feedback}`;
            await playTts(feedbackText);
          }

          advanceTimerRef.current = setTimeout(() => {
            setSessionState("completed");
            router.push(`/mock-interview/report?session=${sessionId}`);
          }, autoContinue ? 1500 : 60000);
          return;
        }

        setNextTurn(result.next_question);
        setSessionState("feedback");

        if (!textMode && !ttsUnavailable && !muted) {
          const feedbackText = `Score ${result.evaluated_turn.score} out of 10. ${result.evaluated_turn.feedback}`;
          await playTts(feedbackText);
        }

        if (autoContinue) {
          advanceTimerRef.current = setTimeout(() => {
            continueFromFeedbackRef.current?.(result.next_question);
          }, 1000);
        }
      } catch (err) {
        setError(err);
        setSessionState("listening");
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, textMode, ttsUnavailable, muted, autoContinue, playTts, router]
  );

  const continueFromFeedback = useCallback(
    async (turnOverride) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }

      const turn = turnOverride ?? nextTurn;
      if (!turn) {
        setSessionState("completed");
        router.push(`/mock-interview/report?session=${sessionId}`);
        return;
      }

      setCurrentTurn(turn);
      setEvaluated(null);
      setNextTurn(null);
      setTranscript("");
      setTextAnswer("");

      if (!textMode && !ttsUnavailable) {
        await speakThenListen(turn.question);
      } else {
        setSessionState("listening");
      }
    },
    [nextTurn, router, sessionId, speakThenListen, textMode, ttsUnavailable]
  );

  continueFromFeedbackRef.current = continueFromFeedback;

  const submitVoiceAnswer = useCallback(
    async (blob) => {
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
        await submitAnswer(sttText);
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
          setError(new Error("Couldn't hear you — try again."));
          setSessionState("listening");
        } else {
          setError(err);
          setSessionState("listening");
        }
      }
    },
    [submitAnswer]
  );

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
    abortSpeaking();
    if (sessionState === "disha_speaking") {
      setSessionState("listening");
    }
  }, [abortSpeaking, sessionState]);

  const handleTextSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      await submitAnswer(textAnswer);
    },
    [submitAnswer, textAnswer]
  );

  return {
    sessionState,
    session,
    currentTurn,
    evaluated,
    nextTurn,
    transcript,
    textAnswer,
    setTextAnswer,
    error,
    setError,
    textMode,
    setTextMode,
    ttsUnavailable,
    autoContinue,
    setAutoContinue,
    sessionStartTime,
    lastScore,
    coachTip,
    submitting,
    muted,
    setMuted: ttsPlayer.setMuted,
    recorder,
    playTts,
    abortSpeaking,
    skipSpeaking,
    toggleRecording,
    startHoldRecording,
    stopHoldRecording,
    continueFromFeedback,
    handleTextSubmit,
    submitAnswer,
  };
}

/** Store welcome message for TTS on first load of active session. */
export function storeInterviewWelcome(sessionId, welcomeMessage) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `${WELCOME_KEY_PREFIX}${sessionId}`,
    JSON.stringify({ welcome_message: welcomeMessage })
  );
}
