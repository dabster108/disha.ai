"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useProfile } from "@/context/ProfileContext";

/** Loads the backend profile for the signed-in Clerk user (once per account). */
export function ClerkProfileBridge({ children }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const { syncFromClerk, clearProfile } = useProfile();
  const syncedKeyRef = useRef(null);

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    undefined;

  useEffect(() => {
    if (!isLoaded || !userLoaded) return;

    if (!isSignedIn || !userId) {
      syncedKeyRef.current = null;
      clearProfile();
      return;
    }

    const syncKey = `${userId}:${email ?? ""}`;
    if (syncedKeyRef.current === syncKey) return;

    syncedKeyRef.current = syncKey;
    syncFromClerk(userId, email);
  }, [isLoaded, userLoaded, isSignedIn, userId, email, syncFromClerk, clearProfile]);

  return children;
}
