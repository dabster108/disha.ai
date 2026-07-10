"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { synthesizeSpeech, ApiError } from "@/lib/api";

/** @param {string} text */
async function speakWithBrowser(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("Browser speech synthesis unavailable");
  }

  const voices = await new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    }, 300);
  });

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const english =
      voices.find((v) => v.lang.startsWith("en") && v.localService) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (english) utterance.voice = english;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => reject(new Error("Browser speech failed"));

    window.speechSynthesis.speak(utterance);
  });
}

export function useTtsPlayer() {
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const [ttsProvider, setTtsProvider] = useState(/** @type {'google'|'edge'|'browser'|'server'|null} */ (null));
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const utteranceRef = useRef(null);

  const revokeAudioUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const abortBrowserSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  }, []);

  const abortSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    abortBrowserSpeech();
    revokeAudioUrl();
    setIsSpeaking(false);
  }, [abortBrowserSpeech, revokeAudioUrl]);

  const playTts = useCallback(
    async (text) => {
      if (!text?.trim() || muted) return false;

      abortSpeaking();
      setIsSpeaking(true);

      try {
        const { blob, provider } = await synthesizeSpeech(text);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        await new Promise((resolve, reject) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => resolve(true);
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });

        setTtsProvider(provider === "google" ? "google" : provider === "edge" ? "edge" : "server");
        setTtsUnavailable(false);
        return true;
      } catch (err) {
        try {
          await speakWithBrowser(text);
          setTtsProvider("browser");
          setTtsUnavailable(false);
          return true;
        } catch {
          if (err instanceof ApiError && err.status === 503) {
            setTtsUnavailable(true);
          } else if (!(typeof window !== "undefined" && window.speechSynthesis)) {
            setTtsUnavailable(true);
          }
          return false;
        }
      } finally {
        setIsSpeaking(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        revokeAudioUrl();
        abortBrowserSpeech();
      }
    },
    [abortBrowserSpeech, abortSpeaking, muted, revokeAudioUrl]
  );

  useEffect(() => {
    return () => {
      abortSpeaking();
    };
  }, [abortSpeaking]);

  return {
    ttsUnavailable,
    ttsProvider,
    setTtsUnavailable,
    muted,
    setMuted,
    isSpeaking,
    playTts,
    abortSpeaking,
  };
}
