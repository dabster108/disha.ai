"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORDING_MS = 3 * 60 * 1000;

/**
 * Microphone capture via MediaRecorder (audio/webm).
 * Exposes volume level from AnalyserNode for waveform UI.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const blobPromiseRef = useRef(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setVolume(0);
  }, []);

  const startVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setVolume(avg / 255);
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

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return blobPromiseRef.current;
    setError(null);
    chunksRef.current = [];

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
      }
    }, 200);

    return blobPromiseRef.current;
  }, [ensureStream, startVolumeLoop, stopVolumeLoop]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    return blobPromiseRef.current;
  }, []);

  const cleanup = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    stopVolumeLoop();
    stopTracks();
    recorderRef.current = null;
  }, [stopTracks, stopVolumeLoop]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isRecording,
    durationMs,
    volume,
    error,
    maxRecordingMs: MAX_RECORDING_MS,
    warningAtMs: 2.5 * 60 * 1000,
    startRecording,
    stopRecording,
    cleanup,
    clearError: () => setError(null),
  };
}
