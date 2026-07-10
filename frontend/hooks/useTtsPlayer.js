"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { synthesizeSpeech, ApiError } from "@/lib/api";

export function useTtsPlayer() {
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  const revokeAudioUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const abortSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    revokeAudioUrl();
    setIsSpeaking(false);
  }, [revokeAudioUrl]);

  const playTts = useCallback(
    async (text, textMode = false) => {
      if (!text?.trim() || textMode || ttsUnavailable || muted) return false;

      abortSpeaking();
      setIsSpeaking(true);

      try {
        const blob = await synthesizeSpeech(text);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        await new Promise((resolve, reject) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => resolve(true);
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setTtsUnavailable(true);
        }
        return false;
      } finally {
        abortSpeaking();
      }
    },
    [abortSpeaking, muted, ttsUnavailable]
  );

  useEffect(() => {
    return () => {
      abortSpeaking();
    };
  }, [abortSpeaking]);

  return {
    ttsUnavailable,
    setTtsUnavailable,
    muted,
    setMuted,
    isSpeaking,
    playTts,
    abortSpeaking,
  };
}
