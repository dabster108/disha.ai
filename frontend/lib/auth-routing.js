"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useProfile } from "@/context/ProfileContext";

/**
 * Where "Get Started" should go:
 * - signed out → sign-in
 * - signed in → dashboard (ProfileGuard routes new users to onboarding)
 */
export function useGetStartedHref() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded } = useUser();
  const { profileId, profileReady } = useProfile();

  const ready = isLoaded && userLoaded && (!isSignedIn || profileReady);

  if (!ready) {
    return { href: "/sign-in", label: "Get Started", ready: false };
  }

  if (!isSignedIn) {
    return { href: "/sign-in", label: "Get Started", ready: true };
  }

  if (profileId) {
    return { href: "/dashboard", label: "Go to Dashboard", ready: true };
  }

  return { href: "/dashboard", label: "Get Started", ready: true };
}
