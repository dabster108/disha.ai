"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile as useProfileContext } from "@/context/ProfileContext";
import { getLatestGap, getLatestRoadmap, getInterviewHistory, getPracticeHistory } from "@/lib/api";
import { mergeExtendedProfile, saveExtendedProfile } from "@/lib/profile-store";
import type { StudentProfileExtended, ApiProfile } from "@/types/profile";
import LoadingState from "@/components/ui/LoadingState";
import { ProfileHero } from "@/components/profile/ProfileHero";
import {
  PersonalInfoSection,
  EducationSection,
  ExperienceSection,
  CareerGoalSection,
  SkillsSection,
  ProjectsSection,
  CertificationsSection,
  PortfolioSection,
  CareerPreferencesSection,
  AiSummarySection,
  ActivitySection,
  PrivacySection,
} from "@/components/profile/ProfileSections";

export default function ProfilePage() {
  const { profile, profileId, loading } = useProfileContext();
  const [extended, setExtended] = useState<StudentProfileExtended | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    setExtended(mergeExtendedProfile(profile as ApiProfile | null));
    setReady(true);
  }, [profileId, profile]);

  useEffect(() => {
    if (!profileId || !extended) return;

    async function enrich() {
      try {
        const [gapRes, roadmapRes, interviews, practices] = await Promise.allSettled([
          getLatestGap(profileId!),
          getLatestRoadmap(profileId!),
          getInterviewHistory(profileId!),
          getPracticeHistory(profileId!),
        ]);

        setExtended((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          if (gapRes.status === "fulfilled") {
            const gd = gapRes.value.gap_data;
            next.aiSummary = {
              ...next.aiSummary,
              jobReadiness: gd.readiness_score ?? next.aiSummary.jobReadiness,
              topStrengths: gd.matched_skills?.slice(0, 3).map((s: { skill: string }) => s.skill) ?? next.aiSummary.topStrengths,
              skillsToImprove: gd.priority_learn?.slice(0, 3).map((p: { skill: string }) => p.skill) ?? next.aiSummary.skillsToImprove,
            };
          }
          if (roadmapRes.status === "fulfilled") {
            const rm = roadmapRes.value;
            const total = rm.weeks?.reduce((n: number, w: { tasks: unknown[] }) => n + w.tasks.length, 0) ?? 0;
            const done = rm.progress?.completed?.length ?? 0;
            next.aiSummary.roadmapProgress = total > 0 ? Math.round((done / total) * 100) : 0;
          }
          const completedInterviews = interviews.status === "fulfilled"
            ? interviews.value.filter((s: { status: string }) => s.status === "completed").length
            : 0;
          const completedPractice = practices.status === "fulfilled"
            ? practices.value.filter((s: { status: string }) => s.status === "completed").length
            : 0;
          next.activity = {
            ...next.activity,
            mockInterviews: completedInterviews,
            projectsCompleted: next.projects.length,
            certificates: next.certifications.length,
          };
          if (completedPractice > 0) next.activity.learningHours = Math.max(next.activity.learningHours, completedPractice * 2);
          return next;
        });
      } catch {
        /* keep mock defaults */
      }
    }
    enrich();
  }, [profileId, extended?.personal.fullName]);

  const persist = useCallback(
    (data: StudentProfileExtended) => {
      setExtended(data);
      if (profileId) saveExtendedProfile(profileId, data);
    },
    [profileId]
  );

  if (loading || !ready || !extended) {
    return <LoadingState label="Loading your profile..." />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8 md:p-12">
      <ProfileHero profile={extended} onEdit={() => document.getElementById("personal")?.scrollIntoView({ behavior: "smooth" })} />
      <PersonalInfoSection data={extended} onChange={persist} />
      <EducationSection data={extended} onChange={persist} />
      <ExperienceSection data={extended} onChange={persist} />
      <CareerGoalSection data={extended} onChange={persist} />
      <SkillsSection data={extended} onChange={persist} />
      <ProjectsSection data={extended} onChange={persist} />
      <CertificationsSection data={extended} onChange={persist} />
      <PortfolioSection data={extended} onChange={persist} />
      <CareerPreferencesSection data={extended} onChange={persist} />
      <AiSummarySection data={extended} />
      <ActivitySection data={extended} />
      <PrivacySection data={extended} onChange={persist} />
    </div>
  );
}
