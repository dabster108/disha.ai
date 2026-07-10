"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Best-effort live (interim) transcription via the Web Speech API.
 *
 * This is a progressive enhancement used only to show words as the user speaks —
 * the authoritative transcript still comes from the server (Groq Whisper). If
 * the browser lacks SpeechRecognition (Firefox, some mobile), `supported` is
 * false and callers simply show a "Listening…" placeholder instead.
 */
export function useLiveTranscript() {
  const [interimText, setInterimText] = useState("");
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const activeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    stop();
    finalRef.current = "";
    setInterimText("");

    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i];
          if (chunk.isFinal) {
            finalRef.current = `${finalRef.current} ${chunk[0].transcript}`.trim();
          } else {
            interim += chunk[0].transcript;
          }
        }
        setInterimText(`${finalRef.current} ${interim}`.trim());
      };

      rec.onerror = () => {
        /* ignore — server STT is the source of truth */
      };

      rec.onend = () => {
        // Auto-restart if we're still meant to be listening (Chrome ends
        // recognition periodically on its own).
        if (activeRef.current && recognitionRef.current === rec) {
          try {
            rec.start();
          } catch {
            /* ignore */
          }
        }
      };

      activeRef.current = true;
      recognitionRef.current = rec;
      rec.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [stop]);

  const reset = useCallback(() => setInterimText(""), []);

  useEffect(() => stop, [stop]);

  return { interimText, supported, start, stop, reset };
}
