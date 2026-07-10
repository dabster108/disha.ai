"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Palette,
  Bell,
  Shield,
  Lock,
  Briefcase,
  Sparkles,
  Link2,
  Database,
  CreditCard,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { useProfile as useProfileContext } from "@/context/ProfileContext";
import type { ApiProfile } from "@/types/profile";
import { loadAppSettings, saveAppSettings, DEFAULT_SETTINGS } from "@/lib/settings-store";
import type { AppSettings, SettingsCategory } from "@/types/settings";
import { SettingsPanel, SettingsRow, ThemeOption } from "@/components/settings/SettingsPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const NAV: { id: SettingsCategory; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "career", label: "Career Preferences", icon: Briefcase },
  { id: "ai", label: "AI Preferences", icon: Sparkles },
  { id: "connected", label: "Connected Accounts", icon: Link2 },
  { id: "data", label: "Data", icon: Database },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "about", label: "About", icon: Info },
];

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsCategory>("account");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const theme = useTheme();
  const { profile: rawProfile, profileId } = useProfileContext();
  const profile = rawProfile as ApiProfile | null;

  useEffect(() => {
    setSettings(loadAppSettings(profileId, profile?.settings_meta ?? null));
  }, [profileId, profile?.settings_meta]);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAppSettings(profileId, next);
      return next;
    });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-8 md:flex-row md:p-12">
      <nav className="md:w-56 md:shrink-0">
        <h1 className="mb-6 text-display-lg-mobile font-semibold text-on-surface md:text-headline-lg">Settings</h1>
        <ul className="space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setActive(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-label-md transition-colors",
                  active === id
                    ? "bg-surface-container-low font-semibold text-primary"
                    : "text-secondary hover:bg-surface-container-low hover:text-on-surface"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <motion.div key={active} className="min-w-0 flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {active === "account" && (
          <SettingsPanel title="Account" description="Manage your account details.">
            <SettingsRow label="Profile Picture">
              <Button variant="secondary" size="sm">
                Change
              </Button>
            </SettingsRow>
            <SettingsRow label="Name">
              <Input className="w-64" defaultValue={profile?.full_name || ""} />
            </SettingsRow>
            <SettingsRow label="Email">
              <Input className="w-64" type="email" defaultValue={profile?.email || ""} />
            </SettingsRow>
            <SettingsRow label="Phone">
              <Input className="w-64" defaultValue={profile?.phone || ""} />
            </SettingsRow>
            <SettingsRow label="Password">
              <Button variant="secondary" size="sm">
                Change Password
              </Button>
            </SettingsRow>
            <Separator className="my-4" />
            <SettingsRow label="Deactivate Account" description="Temporarily disable your account">
              <Button variant="secondary" size="sm">
                Deactivate
              </Button>
            </SettingsRow>
            <SettingsRow label="Delete Account" description="Permanently remove all data">
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "appearance" && (
          <SettingsPanel title="Appearance" description="Customize how DISHA looks and feels.">
            <SettingsRow label="Theme">
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <ThemeOption key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={theme.theme === t} onClick={() => theme.setTheme(t)} />
                ))}
              </div>
            </SettingsRow>
            <SettingsRow label="Font Size">
              <div className="flex gap-2">
                <ThemeOption label="Default" active={theme.fontSize === "default"} onClick={() => theme.setFontSize("default")} />
                <ThemeOption label="Large" active={theme.fontSize === "large"} onClick={() => theme.setFontSize("large")} />
              </div>
            </SettingsRow>
            <SettingsRow label="Compact Mode" description="Reduce spacing across the app">
              <Switch checked={theme.compactMode} onCheckedChange={theme.setCompactMode} />
            </SettingsRow>
            <SettingsRow label="Reduce Motion" description="Minimize animations">
              <Switch checked={theme.reduceMotion} onCheckedChange={theme.setReduceMotion} />
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "notifications" && (
          <SettingsPanel title="Notifications" description="Choose what you want to be notified about.">
            {(
              [
                ["email", "Email notifications"],
                ["push", "Push notifications"],
                ["roadmapUpdates", "Roadmap updates"],
                ["interviewReminders", "Interview reminders"],
                ["learningReminders", "Learning reminders"],
                ["jobAlerts", "Job alerts"],
                ["applicationUpdates", "Application updates"],
                ["weeklyReports", "Weekly reports"],
                ["marketing", "Marketing emails"],
              ] as const
            ).map(([key, label]) => (
              <SettingsRow key={key} label={label}>
                <Switch
                  checked={settings.notifications[key]}
                  onCheckedChange={(v) =>
                    update({ notifications: { ...settings.notifications, [key]: v } })
                  }
                />
              </SettingsRow>
            ))}
          </SettingsPanel>
        )}

        {active === "security" && (
          <SettingsPanel title="Security" description="Protect your account.">
            <SettingsRow label="Change Password">
              <Button variant="secondary" size="sm">
                Update
              </Button>
            </SettingsRow>
            <SettingsRow label="Two-Factor Authentication">
              <Switch
                checked={settings.security.twoFactorEnabled}
                onCheckedChange={(v) => update({ security: { ...settings.security, twoFactorEnabled: v } })}
              />
            </SettingsRow>
            <SettingsRow label="Active Sessions" description="2 devices">
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            </SettingsRow>
            <SettingsRow label="Recovery Codes">
              <Button variant="secondary" size="sm">
                Generate
              </Button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "privacy" && (
          <SettingsPanel title="Privacy" description="Control your data visibility.">
            {(
              [
                ["recruiterAccess", "Recruiter access"],
                ["universityAccess", "University access"],
                ["analytics", "Usage analytics"],
                ["cookies", "Functional cookies"],
              ] as const
            ).map(([key, label]) => (
              <SettingsRow key={key} label={label}>
                <Switch
                  checked={settings.privacy[key]}
                  onCheckedChange={(v) => update({ privacy: { ...settings.privacy, [key]: v } })}
                />
              </SettingsRow>
            ))}
          </SettingsPanel>
        )}

        {active === "career" && (
          <SettingsPanel title="Career Preferences" description="Default job search preferences.">
            <SettingsRow label="Preferred Roles">
              <Input className="w-64" defaultValue={profile?.target_role || ""} />
            </SettingsRow>
            <SettingsRow label="Expected Salary">
              <Input className="w-64" placeholder="NPR 80,000 / month" />
            </SettingsRow>
            <SettingsRow label="Preferred Locations">
              <Input className="w-64" placeholder="Kathmandu, Remote" />
            </SettingsRow>
            <SettingsRow label="Remote Preference">
              <select className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm">
                <option>Hybrid</option>
                <option>Remote</option>
                <option>On-site</option>
              </select>
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "ai" && (
          <SettingsPanel title="AI Preferences" description="How DISHA guides your career.">
            <SettingsRow label="Automatic Roadmap Updates">
              <Switch
                checked={settings.ai.automaticRoadmapUpdates}
                onCheckedChange={(v) => update({ ai: { ...settings.ai, automaticRoadmapUpdates: v } })}
              />
            </SettingsRow>
            <SettingsRow label="Learning Pace">
              <select
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm"
                value={settings.ai.learningPace}
                onChange={(e) =>
                  update({
                    ai: {
                      ...settings.ai,
                      learningPace: e.target.value as AppSettings["ai"]["learningPace"],
                    },
                  })
                }
              >
                <option value="relaxed">Relaxed</option>
                <option value="balanced">Balanced</option>
                <option value="intensive">Intensive</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Interview Difficulty">
              <select
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm"
                value={settings.ai.interviewDifficulty}
                onChange={(e) =>
                  update({
                    ai: {
                      ...settings.ai,
                      interviewDifficulty: e.target.value as AppSettings["ai"]["interviewDifficulty"],
                    },
                  })
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Recommendation Frequency">
              <select
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm"
                value={settings.ai.recommendationFrequency}
                onChange={(e) =>
                  update({
                    ai: {
                      ...settings.ai,
                      recommendationFrequency: e.target.value as AppSettings["ai"]["recommendationFrequency"],
                    },
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Preferred Learning Style">
              <select
                className="h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm"
                value={settings.ai.preferredLearningStyle}
                onChange={(e) =>
                  update({
                    ai: {
                      ...settings.ai,
                      preferredLearningStyle: e.target.value as AppSettings["ai"]["preferredLearningStyle"],
                    },
                  })
                }
              >
                <option value="video">Video</option>
                <option value="reading">Reading</option>
                <option value="projects">Projects</option>
                <option value="mixed">Mixed</option>
              </select>
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "connected" && (
          <SettingsPanel title="Connected Accounts" description="Link external services.">
            {settings.connectedAccounts.map((acct) => (
              <SettingsRow key={acct.id} label={acct.provider} description={acct.connected ? acct.email || "Connected" : "Not connected"}>
                {acct.connected ? (
                  <Button variant="secondary" size="sm">
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm">
                    Connect
                  </Button>
                )}
              </SettingsRow>
            ))}
          </SettingsPanel>
        )}

        {active === "data" && (
          <SettingsPanel title="Data" description="Export or delete your data.">
            {["Export Profile", "Download Resume", "Export Learning History", "Export Roadmap", "Export Interview Reports"].map(
              (label) => (
                <SettingsRow key={label} label={label}>
                  <Button variant="secondary" size="sm">
                    Export
                  </Button>
                </SettingsRow>
              )
            )}
            <Separator className="my-4" />
            <SettingsRow label="Delete All Data" description="Cannot be undone">
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </SettingsRow>
          </SettingsPanel>
        )}

        {active === "billing" && (
          <SettingsPanel title="Billing" description="Manage your subscription.">
            <div className="mb-6 flex items-center justify-between rounded-xl border border-outline-variant p-5">
              <div>
                <p className="font-semibold text-on-surface">Current Plan</p>
                <p className="text-sm text-secondary">{settings.billing.plan}</p>
              </div>
              <Badge>{settings.billing.plan}</Badge>
            </div>
            <SettingsRow label="Payment Method">{settings.billing.paymentMethod}</SettingsRow>
            <SettingsRow label="Renewal">{settings.billing.renewalDate}</SettingsRow>
            <Button className="mt-4">Upgrade Plan</Button>
          </SettingsPanel>
        )}

        {active === "about" && (
          <SettingsPanel title="About DISHA AI" description="App information and support.">
            <SettingsRow label="Version">
              <span className="text-sm text-secondary">1.0.0</span>
            </SettingsRow>
            {["Terms of Service", "Privacy Policy", "Support", "Send Feedback"].map((label) => (
              <SettingsRow key={label} label={label}>
                <Button variant="ghost" size="sm">
                  Open
                </Button>
              </SettingsRow>
            ))}
          </SettingsPanel>
        )}
      </motion.div>
    </div>
  );
}
