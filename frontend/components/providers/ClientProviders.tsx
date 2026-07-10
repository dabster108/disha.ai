"use client";

import { ProfileProvider } from "@/context/ProfileContext";
import { ThemeProvider } from "@/context/ThemeContext";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </ProfileProvider>
  );
}
