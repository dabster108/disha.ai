import type { AppSettings } from "@/types/settings";
import { updateProfile } from "@/lib/api";

const STORAGE_PREFIX = "disha-app-settings-";

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    email: true,
    push: true,
    roadmapUpdates: true,
    interviewReminders: true,
    learningReminders: true,
    jobAlerts: true,
    applicationUpdates: true,
    weeklyReports: true,
    marketing: false,
  },
  security: {
    twoFactorEnabled: false,
    recoveryCodesGenerated: false,
  },
  privacy: {
    profileVisibility: "recruiters",
    resumeVisibility: "recruiters",
    recruiterAccess: true,
    universityAccess: false,
    analytics: true,
    cookies: true,
  },
  ai: {
    automaticRoadmapUpdates: true,
    manualUpdates: false,
    learningPace: "balanced",
    interviewDifficulty: "medium",
    recommendationFrequency: "weekly",
    preferredLearningStyle: "mixed",
  },
  connectedAccounts: [
    { id: "google", provider: "Google", connected: false },
    { id: "github", provider: "GitHub", connected: false },
    { id: "linkedin", provider: "LinkedIn", connected: false },
    { id: "microsoft", provider: "Microsoft", connected: false },
    { id: "apple", provider: "Apple", connected: false },
    { id: "leetcode", provider: "LeetCode", connected: false },
    { id: "kaggle", provider: "Kaggle", connected: false },
  ],
  billing: {
    plan: "Free",
    renewalDate: "—",
    paymentMethod: "None",
  },
};

function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
  const merged = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value && typeof value === "object" && !Array.isArray(value) && typeof merged[key] === "object") {
      merged[key] = deepMerge(merged[key] as object, value as object) as T[keyof T];
    } else if (value !== undefined) {
      merged[key] = value as T[keyof T];
    }
  }
  return merged;
}

export function loadAppSettings(profileId?: string | null, apiMeta?: Record<string, unknown> | null): AppSettings {
  const fromApi =
    apiMeta && Object.keys(apiMeta).length > 0 ? (apiMeta as Partial<AppSettings>) : null;
  let base = fromApi ? deepMerge(DEFAULT_SETTINGS, fromApi) : DEFAULT_SETTINGS;

  if (profileId && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${profileId}`);
      if (raw) base = deepMerge(base, JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }
  return base;
}

let settingsTimer: ReturnType<typeof setTimeout> | null = null;

export function saveAppSettings(profileId: string | null, settings: AppSettings) {
  if (profileId && typeof window !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(settings));
  }
  if (!profileId) return;

  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    updateProfile(profileId, { settings_meta: settings }).catch(() => {});
  }, 500);
}

export { DEFAULT_SETTINGS };
