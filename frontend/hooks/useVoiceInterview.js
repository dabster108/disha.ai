"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerInterview,
  getInterviewHistory,
  transcribeAudio,
  ApiError,
} from "@/lib/api";
import {
  INTERVIEW_MAX_TURNS,
  loadInterviewSessionPrefs,
} from "@/lib/interviewUtils";
import { useAudioRecorder } from "./useAudioRecorder";
import { useTtsPlayer } from "./useTtsPlayer";
import { usePracticeTimer } from "./usePracticeTimer";

const WELCOME_KEY_PREFIX = "disha-interview-welcome-";

/** @typedef {'loading'|'disha_speaking'|'listening'|'recording'|'transcribing'|'evaluating'|'feedback'|'session_timeout'|'completed'} SessionState */

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
  const [dishaCaption, setDishaCaption] = useState("");
  const [sttUnavailable, setSttUnavailable] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);

  const ttsPlayer = useTtsPlayer();
  const ttsUnavailable = ttsPlayer.ttsUnavailable;
  const muted = ttsPlayer.muted;

  const initDoneRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const continueFromFeedbackRef = useRef(null);
  const questionExpireHandlerRef = useRef(null);
  const finishRecordingRef = useRef(null);
  const processingRecordingRef = useRef(false);
  const sessionStateRef = useRef(sessionState);

  const recorder = useAudioRecorder();
  const abortSpeaking = ttsPlayer.abortSpeaking;

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const handleSessionExpire = useCallback(() => {
    recorder.cleanup();
    abortSpeaking();
    setSessionState("session_timeout");
    router.push(`/mock-interview/report?session=${sessionId}`);
  }, [abortSpeaking, recorder, router, sessionId]);

  const handleQuestionExpire = useCallback(async () => {
    const state = sessionStateRef.current;
    if (state === "recording") {
      finishRecordingRef.current?.finishRecordingAndSubmit();
      return;
    }
    if (state === "listening") {
      questionExpireHandlerRef.current?.submitAnswer(
        "I ran out of time on this question and would like to move on."
      );
    }
  }, [recorder]);

  const timer = usePracticeTimer({
    sessionDurationMinutes,
    challengeCount: INTERVIEW_MAX_TURNS,
    onSessionExpire: handleSessionExpire,
    onChallengeExpire: handleQuestionExpire,
  });

  const pauseTimersForSpeech = useCallback(() => {
    timer.pauseTimers();
  }, [timer]);

  const resumeTimersForListen = useCallback(() => {
    timer.resumeTimers();
    timer.startChallengeTimer();
  }, [timer]);

  const playTts = useCallback(
    async (text) => {
      if (!text?.trim() || muted) {
        if (text?.trim()) setDishaCaption(text.trim());
        return false;
      }

      setDishaCaption(text.trim());
      setSessionState("disha_speaking");
      pauseTimersForSpeech();
      return await ttsPlayer.playTts(text);
    },
    [muted, pauseTimersForSpeech, ttsPlayer]
  );

  const speakThenListen = useCallback(
    async (text) => {
      await playTts(text);
      if (textMode) {
        setSessionState("listening");
        return;
      }
      resumeTimersForListen();
      await finishRecordingRef.current?.beginAutoListen();
    },
    [playTts, resumeTimersForListen, textMode]
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
    async (foundSession, pendingTurn) => {
      if (!pendingTurn) {
        router.replace(`/mock-interview/report?session=${sessionId}`);
        return;
      }

      const answeredCount = foundSession.turns.filter((t) => t.answer != null).length;
      const isFresh = answeredCount === 0 && pendingTurn.turn_index === 1;
      const welcomeKey = `${WELCOME_KEY_PREFIX}${sessionId}`;
      const welcomeRaw =
        typeof window !== "undefined" ? sessionStorage.getItem(welcomeKey) : null;

      setDishaCaption(pendingTurn.question);

      if (isFresh && welcomeRaw) {
        try {
          const { welcome_message } = JSON.parse(welcomeRaw);
          sessionStorage.removeItem(welcomeKey);
          if (welcome_message) {
            const combined = `${welcome_message} ${pendingTurn.question}`;
            if (!muted) {
              await speakThenListen(combined);
              return;
            }
            setDishaCaption(combined);
          }
        } catch {
          // ignore malformed storage
        }
      }

      if (!muted) {
        await speakThenListen(pendingTurn.question);
      } else {
        setSessionState("listening");
        resumeTimersForListen();
      }
    },
    [muted, resumeTimersForListen, router, sessionId, speakThenListen]
  );

  const ensureMicOrTextMode = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setTextModeState(true);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setTextModeState(true);
      setError(
        new Error("Microphone access denied — switched to text mode. You can still complete the interview.")
      );
      return false;
    }
  }, []);

  const init = useCallback(async () => {
    if (!sessionId || !profileId || initDoneRef.current) return;
    setSessionState("loading");
    setError(null);

    try {
      const prefs = loadInterviewSessionPrefs(sessionId);
      setSessionDurationMinutes(prefs.minutes);

      const data = await loadSession();
      if (!data) return;

      setSession(data.session);
      setCurrentTurn(data.currentTurn);
      setSessionStartTime(new Date(data.session.started_at).getTime());
      initDoneRef.current = true;

      const elapsedMs = Date.now() - new Date(data.session.started_at).getTime();
      const totalSessionMs = prefs.minutes * 60 * 1000;
      const remainingSessionMs = Math.max(0, totalSessionMs - elapsedMs);

      if (remainingSessionMs <= 0) {
        setSessionState("session_timeout");
        router.replace(`/mock-interview/report?session=${sessionId}`);
        return;
      }

      timer.setSessionRemainingMs(remainingSessionMs);
      timer.startSessionTimer();
      timer.startChallengeTimer();

      const micOk = await ensureMicOrTextMode();
      await runInitialFlow(data.session, data.currentTurn);
      if (!micOk) {
        // Mic denied: type answers, but DISHA still speaks questions above.
      }
    } catch (err) {
      setError(err);
      setSessionState("listening");
    }
  }, [ensureMicOrTextMode, loadSession, profileId, router, runInitialFlow, sessionId, timer]);

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

  const setTextMode = useCallback(
    (value) => {
      setTextModeState(value);
      if (value) abortSpeaking();
      if (value && sessionState === "disha_speaking") {
        resumeTimersForListen();
        setSessionState("listening");
      }
    },
    [abortSpeaking, resumeTimersForListen, sessionState]
  );

  const submitAnswer = useCallback(
    async (answerText) => {
      if (!answerText?.trim() || !sessionId) return;
      setSubmitting(true);
      setError(null);
      setSessionState("evaluating");
      pauseTimersForSpeech();

      try {
        const result = await answerInterview(sessionId, answerText.trim());
        setEvaluated(result.evaluated_turn);
        setLastScore(result.evaluated_turn.score);
        setCoachTip(result.evaluated_turn.feedback);
        setTranscript(answerText.trim());

        const feedbackText = `Score ${result.evaluated_turn.score} out of 10. ${result.evaluated_turn.feedback}`;

        if (result.interview_completed) {
          setNextTurn(null);
          setSessionState("feedback");

          const closing =
            `${feedbackText} That wraps up your mock interview. Let's review your report.`;

          if (!muted) {
            await playTts(closing);
          } else {
            setDishaCaption(closing);
          }

          advanceTimerRef.current = setTimeout(() => {
            setSessionState("completed");
            router.push(`/mock-interview/report?session=${sessionId}`);
          }, autoContinue ? 2000 : 60000);
          return;
        }

        setNextTurn(result.next_question);
        setSessionState("feedback");

        const nextSpeech = result.next_question
          ? `${feedbackText} Next question. ${result.next_question.question}`
          : feedbackText;

        if (!muted) {
          await playTts(nextSpeech);
        } else {
          setDishaCaption(nextSpeech);
        }

        if (autoContinue && result.next_question) {
          if (!muted) {
            setCurrentTurn(result.next_question);
            setEvaluated(null);
            setNextTurn(null);
            setTranscript("");
            setTextAnswer("");
            setDishaCaption(result.next_question.question);
            resumeTimersForListen();
            await finishRecordingRef.current?.beginAutoListen();
          } else {
            advanceTimerRef.current = setTimeout(() => {
              continueFromFeedbackRef.current?.(result.next_question);
            }, 1200);
          }
        }
      } catch (err) {
        setError(err);
        resumeTimersForListen();
        setSessionState("listening");
      } finally {
        setSubmitting(false);
      }
    },
    [
      autoContinue,
      muted,
      pauseTimersForSpeech,
      playTts,
      resumeTimersForListen,
      router,
      sessionId,
      textMode,
      ttsUnavailable,
    ]
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
      setDishaCaption(turn.question);

      if (!muted) {
        await speakThenListen(turn.question);
      } else {
        resumeTimersForListen();
        setSessionState("listening");
      }
    },
    [muted, nextTurn, resumeTimersForListen, router, sessionId, speakThenListen]
  );

  continueFromFeedbackRef.current = continueFromFeedback;

  const submitVoiceAnswer = useCallback(
    async (blob) => {
      setSessionState("transcribing");
      setError(null);
      pauseTimersForSpeech();

      try {
        const { transcript: sttText } = await transcribeAudio(blob);
        if (!sttText?.trim()) {
          setError(new Error("Couldn't hear you — try again."));
          resumeTimersForListen();
          if (!textMode) {
            await finishRecordingRef.current?.beginAutoListen();
          } else {
            setSessionState("listening");
          }
          return;
        }
        setTranscript(sttText);
        await submitAnswer(sttText);
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setSttUnavailable(true);
          setError(
            new Error("Speech recognition unavailable — type your answer or try again later.")
          );
          setTextModeState(true);
        } else if (err instanceof ApiError && err.status === 422) {
          setError(new Error("Couldn't hear you — try again."));
        } else {
          setError(err);
        }
        resumeTimersForListen();
        if (!textMode) {
          await finishRecordingRef.current?.beginAutoListen();
        } else {
          setSessionState("listening");
        }
      }
    },
    [pauseTimersForSpeech, resumeTimersForListen, submitAnswer, textMode]
  );

  const finishRecordingAndSubmit = useCallback(async () => {
    if (processingRecordingRef.current) return;
    processingRecordingRef.current = true;

    try {
      if (!recorder.isRecording && sessionStateRef.current !== "recording") {
        return;
      }

      setSessionState("transcribing");
      pauseTimersForSpeech();
      const blob = await recorder.stopRecording();
      if (blob && blob.size > 0) {
        await submitVoiceAnswer(blob);
      } else {
        setError(new Error("Couldn't hear you — try again."));
        resumeTimersForListen();
        if (!textMode) {
          await finishRecordingRef.current?.beginAutoListen();
        } else {
          setSessionState("listening");
        }
      }
    } finally {
      processingRecordingRef.current = false;
    }
  }, [pauseTimersForSpeech, recorder, resumeTimersForListen, submitVoiceAnswer, textMode]);

  const beginAutoListen = useCallback(async () => {
    if (textMode || submitting || muted) {
      setSessionState("listening");
      return;
    }
    if (recorder.isRecording) return;

    try {
      setSessionState("recording");
      await recorder.startRecording({
        onAutoStop: () => {
          finishRecordingAndSubmit();
        },
      });
    } catch {
      setTextMode(true);
      setSessionState("listening");
    }
  }, [finishRecordingAndSubmit, muted, recorder, submitting, setTextMode, textMode]);

  finishRecordingRef.current = { beginAutoListen, finishRecordingAndSubmit };

  questionExpireHandlerRef.current = { submitAnswer, submitVoice: submitVoiceAnswer };


  const toggleRecording = useCallback(async () => {
    if (textMode) return;
    if (sessionState === "disha_speaking" || sessionState === "transcribing" || sessionState === "evaluating") {
      return;
    }

    if (recorder.error) {
      setTextMode(true);
      setError(recorder.error);
      return;
    }

    if (recorder.isRecording) {
      await finishRecordingAndSubmit();
    } else if (sessionState === "listening" || sessionState === "recording") {
      await beginAutoListen();
    }
  }, [
    beginAutoListen,
    finishRecordingAndSubmit,
    recorder,
    sessionState,
    setTextMode,
    textMode,
  ]);

  const startHoldRecording = useCallback(async () => {
    if (sessionState !== "listening" || recorder.isRecording) return;
    await beginAutoListen();
  }, [beginAutoListen, recorder, sessionState]);

  const stopHoldRecording = useCallback(async () => {
    if (!recorder.isRecording) return;
    await finishRecordingAndSubmit();
  }, [finishRecordingAndSubmit, recorder]);

  const skipSpeaking = useCallback(() => {
    abortSpeaking();
    if (sessionState === "disha_speaking") {
      resumeTimersForListen();
      setSessionState("listening");
    }
  }, [abortSpeaking, resumeTimersForListen, sessionState]);

  const handleTextSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      await submitAnswer(textAnswer);
    },
    [submitAnswer, textAnswer]
  );

  const liveUserCaption =
    sessionState === "recording"
      ? recorder.speechDetected
        ? "Hearing you — will submit when you pause…"
        : "Listening — speak your answer…"
      : sessionState === "transcribing"
        ? "Transcribing your answer…"
        : sessionState === "evaluating"
          ? "DISHA is evaluating…"
          : sessionState === "listening"
            ? "Get ready — mic opens automatically…"
            : "";

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
    ttsProvider: ttsPlayer.ttsProvider,
    sttUnavailable,
    autoContinue,
    setAutoContinue,
    sessionStartTime,
    sessionDurationMinutes,
    sessionRemainingMs: timer.sessionRemainingMs,
    questionRemainingMs: timer.challengeRemainingMs,
    lastScore,
    coachTip,
    submitting,
    muted,
    setMuted: ttsPlayer.setMuted,
    dishaCaption,
    liveUserCaption,
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
