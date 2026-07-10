"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORDING_MS = 3 * 60 * 1000;
const SILENCE_THRESHOLD = 0.028;
const SILENCE_DURATION_MS = 1200;
const MIN_SPEECH_MS = 500;
// Throttle volume state updates so the waveform stays smooth without forcing a
// React re-render on every animation frame (~60fps → ~15fps).
const VOLUME_UPDATE_INTERVAL_MS = 66;

/**
 * Microphone capture via MediaRecorder (audio/webm).
 * Optional silence detection auto-stops when the user finishes speaking.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(0);
  const [speechDetected, setSpeechDetected] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const blobPromiseRef = useRef(null);
  const onAutoStopRef = useRef(null);
  const speechDetectedRef = useRef(false);
  const lastLoudAtRef = useRef(0);
  const autoStoppingRef = useRef(false);
  const autoStopFiredRef = useRef(false);
  const lastVolumeAtRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setVolume(0);
    setSpeechDetected(false);
    speechDetectedRef.current = false;
    autoStoppingRef.current = false;
  }, []);

  const startVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      const vol = avg / 255;

      const now = Date.now();
      if (now - lastVolumeAtRef.current >= VOLUME_UPDATE_INTERVAL_MS) {
        lastVolumeAtRef.current = now;
        setVolume(vol);
      }

      if (recorderRef.current?.state === "recording" && !autoStoppingRef.current) {
        const elapsed = now - startTimeRef.current;
        if (vol > SILENCE_THRESHOLD) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            setSpeechDetected(true);
          }
          lastLoudAtRef.current = now;
        } else if (
          speechDetectedRef.current &&
          elapsed >= MIN_SPEECH_MS &&
          now - lastLoudAtRef.current >= SILENCE_DURATION_MS
        ) {
          autoStoppingRef.current = true;
          recorderRef.current.stop();
          // Guard: the auto-stop callback must fire at most once per cycle so a
          // silence stop and a manual stop can never submit the same take twice.
          if (!autoStopFiredRef.current) {
            autoStopFiredRef.current = true;
            onAutoStopRef.current?.();
          }
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureStream = useCallback(async () => {
    if (streamRef.current?.active) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      const message =
        err?.name === "NotAllowedError"
          ? "Microphone permission denied. Switch to text mode or allow mic access."
          : "Could not access microphone.";
      setError(new Error(message));
      throw err;
    }
  }, []);

  /**
   * @param {{ onAutoStop?: () => void, autoStopOnSilence?: boolean }} [options]
   */
  const startRecording = useCallback(
    async (options = {}) => {
      if (recorderRef.current?.state === "recording") return blobPromiseRef.current;
      setError(null);
      chunksRef.current = [];
      onAutoStopRef.current = options.autoStopOnSilence !== false ? options.onAutoStop ?? null : null;
      speechDetectedRef.current = false;
      setSpeechDetected(false);
      autoStoppingRef.current = false;
      autoStopFiredRef.current = false;
      lastVolumeAtRef.current = 0;
      lastLoudAtRef.current = Date.now();

      const stream = await ensureStream();
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      blobPromiseRef.current = new Promise((resolve) => {
        recorder.onstop = () => {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsRecording(false);
          stopVolumeLoop();
          const blob = new Blob(chunksRef.current, { type: mimeType });
          resolve(blob);
        };
      });

      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDurationMs(0);
      startVolumeLoop();

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDurationMs(elapsed);
        if (elapsed >= MAX_RECORDING_MS) {
          recorder.stop();
          if (!autoStopFiredRef.current) {
            autoStopFiredRef.current = true;
            onAutoStopRef.current?.();
          }
        }
      }, 200);

      return blobPromiseRef.current;
    },
    [ensureStream, startVolumeLoop, stopVolumeLoop]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    return blobPromiseRef.current;
  }, []);

  const isRecordingActive = useCallback(
    () => recorderRef.current?.state === "recording",
    []
  );

  const cleanup = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    stopVolumeLoop();
    stopTracks();
    recorderRef.current = null;
    onAutoStopRef.current = null;
  }, [stopTracks, stopVolumeLoop]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isRecording,
    durationMs,
    volume,
    speechDetected,
    error,
    maxRecordingMs: MAX_RECORDING_MS,
    warningAtMs: 2.5 * 60 * 1000,
    startRecording,
    stopRecording,
    isRecordingActive,
    cleanup,
    clearError: () => setError(null),
  };
}
