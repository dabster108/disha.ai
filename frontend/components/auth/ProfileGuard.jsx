"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import { useProfile } from "@/context/ProfileContext";

export default function ProfileGuard({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const { profileId, profile, loading, profileReady } = useProfile();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const hasProfile = Boolean(profileId && profile);

  useEffect(() => {
    if (!clerkLoaded || !profileReady || loading) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (!hasProfile && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace("/onboarding");
    }
    if (hasProfile) {
      redirectedRef.current = false;
    }
  }, [clerkLoaded, profileReady, loading, isSignedIn, hasProfile, router]);

  if (!clerkLoaded || !profileReady || loading) {
    return <LoadingState label="Loading your profile..." />;
  }

  if (!isSignedIn || !hasProfile) {
    return <LoadingState label="Loading your profile..." />;
  }

  return children;
}
