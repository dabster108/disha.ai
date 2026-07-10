"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerInterview, getInterviewHistory, transcribeAudio, ApiError } from "@/lib/api";
import { loadInterviewSessionPrefs, formatInterviewSummary } from "@/lib/interviewUtils";
import { useAudioRecorder } from "./useAudioRecorder";
import { useTtsPlayer } from "./useTtsPlayer";
import { useLiveTranscript } from "./useLiveTranscript";
import { usePracticeTimer } from "./usePracticeTimer";

const WELCOME_KEY_PREFIX = "disha-interview-welcome-";
const BOOTSTRAP_KEY_PREFIX = "disha-interview-bootstrap-";

/** @typedef {'loading'|'idle'|'recording'|'transcribing'|'thinking'|'speaking'|'completed'|'timeout'} Phase */

let messageSeq = 0;
const nextId = () => {
  messageSeq += 1;
  return `m${messageSeq}`;
};

/**
 * Conversational (chat-style) interview controller.
 * Shared text + voice composer, live interim transcription, optimistic user
 * bubbles, a typing indicator, and split feedback/question speech so text
 * appears instantly without waiting on audio.
 */
export function useVoiceInterview({ sessionId, profileId, router }) {
  const [phase, setPhase] = useState(/** @type {Phase} */ ("loading"));
  const [messages, setMessages] = useState([]);
  const [composerText, setComposerText] = useState("");
  const [error, setError] = useState(null);
  const [micSupported, setMicSupported] = useState(true);
  const [voiceMode, setVoiceMode] = useState(true);
  const [session, setSession] = useState(null);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);

  const recorder = useAudioRecorder();
  const ttsPlayer = useTtsPlayer();
  const live = useLiveTranscript();

  const processingRef = useRef(false);
  const answeringRef = useRef(false);
  const voiceModeRef = useRef(true);
  const phaseRef = useRef(phase);
  const advanceTimerRef = useRef(null);
  const handlersRef = useRef({});
  const speakRef = useRef(null);
  const beginRecordingRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const pushMessage = useCallback((role, text, extra = {}) => {
    const id = nextId();
    setMessages((prev) => [...prev, { id, role, text, ...extra }]);
    return id;
  }, []);

  // ---- timers ------------------------------------------------------------
  const handleSessionExpire = useCallback(() => {
    recorder.cleanup();
    ttsPlayer.abortSpeaking();
    live.stop();
    setPhase("timeout");
    router.push(`/mock-interview/report?session=${sessionId}`);
  }, [recorder, ttsPlayer, live, router, sessionId]);

  const timer = usePracticeTimer({
    sessionDurationMinutes,
    challengeCount: 1,
    onSessionExpire: handleSessionExpire,
    onChallengeExpire: () => {},
  });
  timerRef.current = timer;

  // ---- speech ------------------------------------------------------------
  const speak = useCallback(
    async (text) => {
      if (!text?.trim() || ttsPlayer.muted) return;
      timer.pauseTimers();
      await ttsPlayer.playTts(text);
    },
    [ttsPlayer, timer]
  );
  speakRef.current = speak;

  // ---- recording ---------------------------------------------------------
  const beginRecording = useCallback(async () => {
    if (!micSupported) return;
    if (recorder.isRecordingActive?.() || recorder.isRecording) return;
    if (["thinking", "transcribing", "loading"].includes(phaseRef.current)) return;

    setError(null);
    setVoiceMode(true);
    live.reset();
    live.start();
    setPhase("recording");
    timer.resumeTimers();

    try {
      await recorder.startRecording({
        onAutoStop: () => handlersRef.current.finishAndSubmit?.(),
      });
    } catch {
      live.stop();
      setMicSupported(false);
      setVoiceMode(false);
      setPhase("idle");
    }
  }, [micSupported, recorder, live, timer]);
  beginRecordingRef.current = beginRecording;

  /** Re-open the mic after DISHA speaks — always leaves phase in recording or idle. */
  const armListening = useCallback(async () => {
    if (voiceModeRef.current && micSupported) {
      setPhase("idle");
      await beginRecording();
      if (!recorder.isRecordingActive?.() && !recorder.isRecording) {
        setPhase("idle");
      }
    } else {
      setPhase("idle");
    }
  }, [micSupported, recorder, beginRecording]);

  const submitAnswer = useCallback(
    async (answerText) => {
      const text = answerText?.trim();
      if (!text || !sessionId || answeringRef.current) return;

      answeringRef.current = true;
      setPhase("thinking");
      timer.pauseTimers();

      try {
        const result = await answerInterview(sessionId, text);

        if (result.interview_completed) {
          const summaryText = formatInterviewSummary(result.session);
          pushMessage("disha", summaryText, { kind: "summary", score: result.session.overall_score });
          setSession(result.session);
          setPhase("speaking");
          try {
            const spokenScore =
              result.session.overall_score != null
                ? `Your overall score is ${result.session.overall_score} out of 10. `
                : "";
            await speak(
              `${spokenScore}That wraps up your mock interview. I've posted your full analysis in the chat.`
            );
          } finally {
            setPhase("completed");
          }
          return;
        }

        const nextQ = result.next_question;
        if (nextQ) pushMessage("disha", nextQ.question, { kind: "question" });

        setPhase("speaking");
        try {
          if (nextQ?.question) await speak(nextQ.question);
        } finally {
          timer.resumeTimers();
          await armListening();
        }
      } catch (err) {
        setError(err);
        setPhase("idle");
        timer.resumeTimers();
        if (voiceModeRef.current && micSupported) {
          await armListening();
        }
      } finally {
        answeringRef.current = false;
      }
    },
    [sessionId, timer, pushMessage, speak, micSupported, armListening]
  );

  const submitVoice = useCallback(
    async (blob) => {
      setPhase("transcribing");
      try {
        const { transcript } = await transcribeAudio(blob);
        const clean = transcript?.trim();
        if (!clean) {
          setError(new Error("Couldn't hear you — try again."));
          await armListening();
          return;
        }
        pushMessage("user", clean, { kind: "answer" });
        await submitAnswer(clean);
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setMicSupported(false);
          setVoiceMode(false);
          setError(new Error("Speech recognition unavailable — please type your answer."));
        } else if (err instanceof ApiError && err.status === 422) {
          setError(new Error("Couldn't hear you — try again."));
        } else {
          setError(err);
        }
        setPhase("idle");
      }
    },
    [pushMessage, submitAnswer, armListening]
  );

  const finishAndSubmit = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      live.stop();
      if (!recorder.isRecording && phaseRef.current !== "recording") return;
      setPhase("transcribing");
      timer.pauseTimers();
      const blob = await recorder.stopRecording();
      if (blob && blob.size > 0) {
        await submitVoice(blob);
      } else {
        setError(new Error("Couldn't hear you — try again."));
        await armListening();
      }
    } finally {
      processingRef.current = false;
    }
  }, [live, recorder, timer, submitVoice, armListening]);

  handlersRef.current.finishAndSubmit = finishAndSubmit;

  const toggleMic = useCallback(async () => {
    if (!micSupported) return;
    if (recorder.isRecording || phaseRef.current === "recording") {
      await finishAndSubmit();
      return;
    }
    if (["thinking", "transcribing", "speaking", "loading"].includes(phaseRef.current)) return;
    await beginRecording();
  }, [micSupported, recorder, finishAndSubmit, beginRecording]);

  const sendText = useCallback(async () => {
    const text = composerText.trim();
    if (!text) return;
    if (answeringRef.current || ["thinking", "transcribing", "speaking", "loading"].includes(phaseRef.current)) {
      return;
    }
    if (recorder.isRecording || recorder.isRecordingActive?.()) {
      await finishAndSubmit();
      return;
    }
    setComposerText("");
    setVoiceMode(false);
    pushMessage("user", text, { kind: "answer" });
    await submitAnswer(text);
  }, [composerText, pushMessage, submitAnswer, recorder, finishAndSubmit]);

  const endInterview = useCallback(() => {
    recorder.cleanup();
    ttsPlayer.abortSpeaking();
    live.stop();
    router.push(`/mock-interview/report?session=${sessionId}`);
  }, [recorder, ttsPlayer, live, router, sessionId]);

  // ---- init --------------------------------------------------------------
  const loadSession = useCallback(async () => {
    if (!sessionId || !profileId) return null;
    const sessions = await getInterviewHistory(profileId);
    const found = sessions.find((s) => String(s.id) === String(sessionId));
    if (!found) throw new Error("Interview session not found.");
    if (found.status === "completed") {
      router.replace(`/mock-interview/report?session=${sessionId}`);
      return null;
    }
    const pending = [...found.turns]
      .sort((a, b) => a.turn_index - b.turn_index)
      .find((t) => t.answer == null);
    return { session: found, pending: pending || null };
  }, [sessionId, profileId, router]);

  const ensureMic = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicSupported(false);
      setVoiceMode(false);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      setMicSupported(false);
      setVoiceMode(false);
      return false;
    }
  }, []);

  // Stable bootstrap effect — only re-runs when session or profile changes.
  // Uses refs for speak/recording/timer so timer ticks don't retrigger init.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!sessionId || !profileId) return;

      setPhase("loading");
      setMessages([]);
      setError(null);

      try {
        const prefs = loadInterviewSessionPrefs(sessionId);
        setSessionDurationMinutes(prefs.minutes);

        // Instant UI from data stored at interview start (no history round-trip).
        const bootstrapKey = `${BOOTSTRAP_KEY_PREFIX}${sessionId}`;
        let bootstrapWelcome = null;
        if (typeof window !== "undefined") {
          const raw = sessionStorage.getItem(bootstrapKey);
          if (raw) {
            try {
              const boot = JSON.parse(raw);
              const instant = [];
              if (boot.welcome_message) {
                bootstrapWelcome = boot.welcome_message;
                instant.push({
                  id: nextId(),
                  role: "disha",
                  kind: "welcome",
                  text: boot.welcome_message,
                });
              }
              if (boot.question) {
                instant.push({
                  id: nextId(),
                  role: "disha",
                  kind: "question",
                  text: boot.question,
                });
              }
              if (instant.length > 0) {
                setMessages(instant);
                setSession({
                  target_role: boot.target_role || "",
                  started_at: boot.started_at,
                });
                setPhase("idle");
              }
              sessionStorage.removeItem(bootstrapKey);
            } catch {
              /* ignore malformed bootstrap */
            }
          }
        }

        const data = await loadSession();
        if (cancelled) return;
        if (!data) return;

        setSession(data.session);

        const answered = [...data.session.turns]
          .sort((a, b) => a.turn_index - b.turn_index)
          .filter((t) => t.answer != null);
        const history = [];
        for (const t of answered) {
          history.push({ id: nextId(), role: "disha", kind: "question", text: t.question });
          history.push({ id: nextId(), role: "user", kind: "answer", text: t.answer });
        }

        const elapsedMs = Date.now() - new Date(data.session.started_at).getTime();
        const remainingMs = Math.max(0, prefs.minutes * 60 * 1000 - elapsedMs);
        if (remainingMs <= 0 || !data.pending) {
          router.replace(`/mock-interview/report?session=${sessionId}`);
          return;
        }

        const t = timerRef.current;
        t?.setSessionRemainingMs(remainingMs);
        t?.startSessionTimer();

        const isFresh = answered.length === 0 && data.pending.turn_index === 1;
        let welcome = bootstrapWelcome;
        const welcomeKey = `${WELCOME_KEY_PREFIX}${sessionId}`;
        if (!welcome && isFresh && typeof window !== "undefined") {
          const raw = sessionStorage.getItem(welcomeKey);
          if (raw) {
            try {
              welcome = JSON.parse(raw).welcome_message || null;
            } catch {
              welcome = null;
            }
            sessionStorage.removeItem(welcomeKey);
          }
        }

        if (welcome && !history.some((m) => m.kind === "welcome")) {
          history.push({ id: nextId(), role: "disha", kind: "welcome", text: welcome });
        }
        if (!history.some((m) => m.kind === "question" && m.text === data.pending.question)) {
          history.push({
            id: nextId(),
            role: "disha",
            kind: "question",
            text: data.pending.question,
          });
        }

        setMessages(history);
        // Show chat immediately — don't wait for mic permission or TTS.
        setPhase("idle");

        const micOk = await ensureMic();
        if (cancelled) return;

        setPhase("speaking");
        const speech = welcome
          ? `${welcome} ${data.pending.question}`
          : data.pending.question;
        try {
          await speakRef.current?.(speech);
        } finally {
          if (cancelled) return;
          if (micOk && voiceModeRef.current) {
            setPhase("idle");
            await beginRecordingRef.current?.();
            if (!recorder.isRecordingActive?.() && !recorder.isRecording) {
              setPhase("idle");
            }
          } else {
            setPhase("idle");
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setPhase("idle");
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      ttsPlayer.abortSpeaking();
      recorder.cleanup();
      live.stop();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, profileId]);

  return {
    phase,
    messages,
    error,
    setError,
    composerText,
    setComposerText,
    interimText: live.interimText,
    volume: recorder.volume,
    recording: recorder.isRecording || phase === "recording",
    micSupported,
    isThinking: phase === "thinking",
    isSpeaking: phase === "speaking",
    toggleMic,
    sendText,
    endInterview,
    targetRole: session?.target_role || "",
    sessionRemainingMs: timer.sessionRemainingMs,
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

/** Store session bootstrap so the active page can render chat instantly. */
export function storeInterviewBootstrap(sessionId, payload) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${BOOTSTRAP_KEY_PREFIX}${sessionId}`, JSON.stringify(payload));
}
