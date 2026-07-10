export type SettingsCategory =
  | "account"
  | "appearance"
  | "notifications"
  | "security"
  | "privacy"
  | "career"
  | "ai"
  | "connected"
  | "data"
  | "billing"
  | "about";

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  roadmapUpdates: boolean;
  interviewReminders: boolean;
  learningReminders: boolean;
  jobAlerts: boolean;
  applicationUpdates: boolean;
  weeklyReports: boolean;
  marketing: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  recoveryCodesGenerated: boolean;
}

export interface PrivacySettingsExtended {
  profileVisibility: "public" | "recruiters" | "private";
  resumeVisibility: "public" | "recruiters" | "private";
  recruiterAccess: boolean;
  universityAccess: boolean;
  analytics: boolean;
  cookies: boolean;
}

export interface AiPreferences {
  automaticRoadmapUpdates: boolean;
  manualUpdates: boolean;
  learningPace: "relaxed" | "balanced" | "intensive";
  interviewDifficulty: "easy" | "medium" | "hard";
  recommendationFrequency: "daily" | "weekly" | "monthly";
  preferredLearningStyle: "video" | "reading" | "projects" | "mixed";
}

export interface ConnectedAccount {
  id: string;
  provider: string;
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface BillingInfo {
  plan: string;
  renewalDate: string;
  paymentMethod: string;
}

export interface AppSettings {
  notifications: NotificationSettings;
  security: SecuritySettings;
  privacy: PrivacySettingsExtended;
  ai: AiPreferences;
  connectedAccounts: ConnectedAccount[];
  billing: BillingInfo;
}
