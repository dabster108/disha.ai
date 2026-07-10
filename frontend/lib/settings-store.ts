import type { AppSettings } from "@/types/settings";

const STORAGE_KEY = "disha-app-settings";

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
    { id: "github", provider: "GitHub", connected: true, email: "pratik@github.com", connectedAt: "2024-03-12" },
    { id: "linkedin", provider: "LinkedIn", connected: false },
    { id: "microsoft", provider: "Microsoft", connected: false },
    { id: "apple", provider: "Apple", connected: false },
    { id: "leetcode", provider: "LeetCode", connected: true, connectedAt: "2024-05-01" },
    { id: "kaggle", provider: "Kaggle", connected: false },
  ],
  billing: {
    plan: "Free",
    renewalDate: "—",
    paymentMethod: "None",
  },
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export { DEFAULT_SETTINGS };
