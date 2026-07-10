"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  fontSize: "default" | "large";
  setFontSize: (size: "default" | "large") => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "disha-appearance";

type AppearanceState = {
  theme: Theme;
  fontSize: "default" | "large";
  compactMode: boolean;
  reduceMotion: boolean;
};

const DEFAULT: AppearanceState = {
  theme: "light",
  fontSize: "default",
  compactMode: false,
  reduceMotion: false,
};

function loadAppearance(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function persistAppearance(state: AppearanceState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceState>(DEFAULT);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setAppearance(loadAppearance());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        appearance.theme === "system" ? (media.matches ? "dark" : "light") : appearance.theme;
      setResolvedTheme(resolved);
      root.classList.toggle("dark", resolved === "dark");
      root.dataset.fontSize = appearance.fontSize;
      root.dataset.compact = appearance.compactMode ? "true" : "false";
      root.dataset.reduceMotion = appearance.reduceMotion ? "true" : "false";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  const update = useCallback((patch: Partial<AppearanceState>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      persistAppearance(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: appearance.theme,
      resolvedTheme,
      setTheme: (theme: Theme) => update({ theme }),
      fontSize: appearance.fontSize,
      setFontSize: (fontSize: "default" | "large") => update({ fontSize }),
      compactMode: appearance.compactMode,
      setCompactMode: (compactMode: boolean) => update({ compactMode }),
      reduceMotion: appearance.reduceMotion,
      setReduceMotion: (reduceMotion: boolean) => update({ reduceMotion }),
    }),
    [appearance, resolvedTheme, update]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
