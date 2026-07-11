"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ProfileProvider } from "@/context/ProfileContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ClerkProfileBridge } from "@/components/auth/ClerkProfileBridge";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ProfileProvider>
        <ClerkProfileBridge>
          <ThemeProvider>{children}</ThemeProvider>
        </ClerkProfileBridge>
      </ProfileProvider>
    </ClerkProvider>
  );
}
