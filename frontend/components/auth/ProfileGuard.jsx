"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import { useProfile } from "@/context/ProfileContext";

export default function ProfileGuard({ children }) {
  const { profileId, profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profileId) {
      router.replace("/onboarding");
    }
  }, [loading, profileId, router]);

  if (loading || !profileId || !profile) {
    return <LoadingState label="Loading your profile..." />;
  }

  return children;
}
