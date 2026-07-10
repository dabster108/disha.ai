"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProfile } from "@/lib/api";

const STORAGE_KEY = "disha_profile_id";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profileId, setProfileId] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (id) => {
    if (!id) {
      setProfileState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProfile(id);
      setProfileState(data);
    } catch (err) {
      setError(err);
      setProfileState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setProfileId(storedId);
    loadProfile(storedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProfile = useCallback((newProfile) => {
    setProfileState(newProfile);
    setProfileId(newProfile?.id ?? null);
    if (typeof window !== "undefined") {
      if (newProfile?.id) {
        localStorage.setItem(STORAGE_KEY, newProfile.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const clearProfile = useCallback(() => {
    setProfileState(null);
    setProfileId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem("disha-interview-text-mode");
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("disha-interview-welcome-"))
        .forEach((k) => sessionStorage.removeItem(k));
    }
  }, []);

  const refreshProfile = useCallback(() => loadProfile(profileId), [loadProfile, profileId]);

  const value = useMemo(
    () => ({ profile, profileId, setProfile, clearProfile, loading, error, refreshProfile }),
    [profile, profileId, setProfile, clearProfile, loading, error, refreshProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
