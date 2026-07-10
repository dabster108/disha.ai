"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProfile, getDashboard } from "@/lib/api";

const STORAGE_KEY = "disha_profile_id";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profileId, setProfileId] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState(null);
  const dashboardFetchedAt = useRef(0);

  const loadAll = useCallback(async (id, { forceDashboard = false } = {}) => {
    if (!id) {
      setProfileState(null);
      setDashboard(null);
      setLoading(false);
      setDashboardLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const dashboardStale =
      forceDashboard || !dashboard || Date.now() - dashboardFetchedAt.current > 60_000;

    if (dashboardStale) setDashboardLoading(true);

    try {
      const [profileResult, dashboardResult] = await Promise.allSettled([
        getProfile(id),
        dashboardStale ? getDashboard(id) : Promise.resolve(null),
      ]);

      if (profileResult.status === "fulfilled") {
        setProfileState(profileResult.value);
      } else {
        setError(profileResult.reason);
        setProfileState(null);
      }

      if (dashboardStale && dashboardResult.status === "fulfilled" && dashboardResult.value) {
        setDashboard(dashboardResult.value);
        dashboardFetchedAt.current = Date.now();
      }
    } finally {
      setLoading(false);
      setDashboardLoading(false);
    }
  }, [dashboard]);

  useEffect(() => {
    const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setProfileId(storedId);
    loadAll(storedId);
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
    if (newProfile?.id) {
      loadAll(newProfile.id, { forceDashboard: true });
    }
  }, [loadAll]);

  const clearProfile = useCallback(() => {
    setProfileState(null);
    setProfileId(null);
    setDashboard(null);
    dashboardFetchedAt.current = 0;
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem("disha-interview-text-mode");
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("disha-interview-welcome-"))
        .forEach((k) => sessionStorage.removeItem(k));
    }
  }, []);

  const refreshProfile = useCallback(
    () => loadAll(profileId, { forceDashboard: false }),
    [loadAll, profileId]
  );

  const refreshDashboard = useCallback(
    () => loadAll(profileId, { forceDashboard: true }),
    [loadAll, profileId]
  );

  const value = useMemo(
    () => ({
      profile,
      profileId,
      dashboard,
      dashboardLoading,
      setProfile,
      clearProfile,
      loading,
      error,
      refreshProfile,
      refreshDashboard,
    }),
    [
      profile,
      profileId,
      dashboard,
      dashboardLoading,
      setProfile,
      clearProfile,
      loading,
      error,
      refreshProfile,
      refreshDashboard,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
