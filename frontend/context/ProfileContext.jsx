"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getProfile, getProfileByClerk, getDashboard, updateProfile } from "@/lib/api";
import { invalidateCache } from "@/lib/resource-cache";
import { loadExtendedProfile, saveExtendedProfile } from "@/lib/profile-store";
import { CAREER_ROLES } from "@/lib/careerRoles";

const STORAGE_KEY = "disha_profile_id";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profileId, setProfileId] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState(null);
  const dashboardFetchedAt = useRef(0);
  const loadGeneration = useRef(0);

  const loadAll = useCallback(async (id, { forceDashboard = false, generation } = {}) => {
    if (!id) {
      if (generation === undefined || generation === loadGeneration.current) {
        setProfileState(null);
        setDashboard(null);
        setLoading(false);
        setDashboardLoading(false);
      }
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

      if (generation !== undefined && generation !== loadGeneration.current) return;

      if (profileResult.status === "fulfilled") {
        setProfileState(profileResult.value);
        setProfileId(profileResult.value.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, profileResult.value.id);
        }
      } else {
        setError(profileResult.reason);
        setProfileState(null);
        setProfileId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      if (dashboardStale && dashboardResult.status === "fulfilled" && dashboardResult.value) {
        setDashboard(dashboardResult.value);
        dashboardFetchedAt.current = Date.now();
      }
    } finally {
      if (generation === undefined || generation === loadGeneration.current) {
        setLoading(false);
        setDashboardLoading(false);
      }
    }
  }, [dashboard]);

  const setProfile = useCallback((newProfile) => {
    setProfileState(newProfile);
    setProfileId(newProfile?.id ?? null);
    setProfileReady(true);
    if (typeof window !== "undefined") {
      if (newProfile?.id) {
        localStorage.setItem(STORAGE_KEY, newProfile.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    if (newProfile?.id) {
      setDashboardLoading(true);
      getDashboard(newProfile.id)
        .then((dashboardData) => {
          setDashboard(dashboardData);
          dashboardFetchedAt.current = Date.now();
        })
        .catch(() => {})
        .finally(() => setDashboardLoading(false));
    }
  }, []);

  const syncFromClerk = useCallback(
    async (clerkUserId, email) => {
      const generation = ++loadGeneration.current;
      setLoading(true);
      setProfileReady(false);
      setError(null);

      const applyProfile = (profileData) => {
        setProfileState(profileData);
        setProfileId(profileData.id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, profileData.id);
        }
      };

      const loadDashboard = async (id) => {
        try {
          const dashboardData = await getDashboard(id);
          if (generation === loadGeneration.current) {
            setDashboard(dashboardData);
            dashboardFetchedAt.current = Date.now();
          }
        } catch {
          // Dashboard is optional on first load — keep the profile we already have.
        }
      };

      try {
        const profileData = await getProfileByClerk(clerkUserId, email);
        if (generation !== loadGeneration.current) return;

        applyProfile(profileData);
        await loadDashboard(profileData.id);
      } catch (err) {
        if (generation !== loadGeneration.current) return;

        if (err?.status === 404) {
          // Fallback: profile may exist but Clerk link was missing (same browser session).
          const storedId =
            typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
          if (storedId) {
            try {
              const byId = await getProfile(storedId);
              const emailMatch =
                !email ||
                !byId.email ||
                byId.email.toLowerCase() === email.toLowerCase();
              if (emailMatch) {
                applyProfile(byId);
                // Retry clerk lookup — backend will link by email on success.
                try {
                  const linked = await getProfileByClerk(clerkUserId, email);
                  if (generation === loadGeneration.current) {
                    applyProfile(linked);
                    await loadDashboard(linked.id);
                  }
                } catch {
                  await loadDashboard(byId.id);
                }
                return;
              }
            } catch {
              /* stored id invalid */
            }
          }

          setProfileState(null);
          setProfileId(null);
          setDashboard(null);
          dashboardFetchedAt.current = 0;
          if (typeof window !== "undefined") {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          setError(err);
        }
      } finally {
        if (generation === loadGeneration.current) {
          setLoading(false);
          setProfileReady(true);
        }
      }
    },
    []
  );

  const clearProfile = useCallback(() => {
    loadGeneration.current += 1;
    setProfileState(null);
    setProfileId(null);
    setDashboard(null);
    setLoading(false);
    setProfileReady(true);
    setError(null);
    dashboardFetchedAt.current = 0;
    invalidateCache();
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

  const goals = useMemo(() => {
    const meta = profile?.profile_meta;
    const fromMeta = meta?.careerPreferences?.preferredRoles;
    const list = Array.isArray(fromMeta) && fromMeta.length > 0
      ? fromMeta.filter(Boolean)
      : profile?.target_role
        ? [profile.target_role]
        : [];
    return [...new Set(list)];
  }, [profile]);

  const activeGoal = profile?.target_role || goals[0] || "";

  const switchGoal = useCallback(
    async (goal) => {
      if (!profileId || !goal || goal === profile?.target_role) return;
      const extended = loadExtendedProfile(profileId, profile);
      extended.careerGoal.dreamJob = goal;
      extended.currentRole = goal;
      extended.careerPreferences.preferredRoles = [
        ...new Set([goal, ...extended.careerPreferences.preferredRoles.filter((g) => g !== goal)]),
      ];
      saveExtendedProfile(profileId, extended);
      const updated = await updateProfile(profileId, {
        target_role: goal,
        profile_meta: extended,
      });
      setProfileState(updated);
      invalidateCache(profileId);
      dashboardFetchedAt.current = 0;
      setDashboardLoading(true);
      try {
        const dashboardData = await getDashboard(profileId);
        setDashboard(dashboardData);
        dashboardFetchedAt.current = Date.now();
      } catch {
        /* keep previous dashboard */
      } finally {
        setDashboardLoading(false);
      }
    },
    [profile, profileId]
  );

  const addGoal = useCallback(
    async (goal) => {
      if (!profileId || !goal) return;
      const exact = CAREER_ROLES.find((r) => r.toLowerCase() === goal.trim().toLowerCase());
      if (!exact) return;
      const extended = loadExtendedProfile(profileId, profile);
      extended.careerPreferences.preferredRoles = [
        ...new Set([...extended.careerPreferences.preferredRoles, exact]),
      ];
      extended.careerGoal.dreamJob = exact;
      extended.currentRole = exact;
      saveExtendedProfile(profileId, extended);
      await switchGoal(exact);
    },
    [profile, profileId, switchGoal]
  );

  const value = useMemo(
    () => ({
      profile,
      profileId,
      dashboard,
      dashboardLoading,
      setProfile,
      clearProfile,
      syncFromClerk,
      profileReady,
      loading,
      error,
      refreshProfile,
      refreshDashboard,
      goals,
      activeGoal,
      switchGoal,
      addGoal,
    }),
    [
      profile,
      profileId,
      dashboard,
      dashboardLoading,
      setProfile,
      clearProfile,
      syncFromClerk,
      profileReady,
      loading,
      error,
      refreshProfile,
      refreshDashboard,
      goals,
      activeGoal,
      switchGoal,
      addGoal,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
