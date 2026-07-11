"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile as useProfileContext } from "@/context/ProfileContext";
import { getInterviewHistory, getPracticeHistory, uploadResume, updateProfile } from "@/lib/api";
import { mergeExtendedProfile, saveExtendedProfile, flushExtendedProfile } from "@/lib/profile-store";
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
  ActivitySection,
  PrivacySection,
} from "@/components/profile/ProfileSections";
import { matchCareerRole } from "@/lib/careerRoles";

function mapParsedSkills(raw?: string[]) {
  if (!raw?.length) return [];
  const categories: Record<string, import("@/types/profile").SkillCategory> = {
    python: "Programming Languages",
    javascript: "Programming Languages",
    typescript: "Programming Languages",
    fastapi: "Frameworks",
    react: "Frameworks",
    nextjs: "Frameworks",
    postgresql: "Databases",
    mongodb: "Databases",
    docker: "DevOps",
    aws: "Cloud",
    tensorflow: "AI",
    communication: "Soft Skills",
  };
  return raw.map((name, i) => {
    const key = name.toLowerCase().replace(/\s+/g, "");
    return {
      id: `skill-${Date.now()}-${i}`,
      name,
      category: categories[key] || "Frameworks",
      level: "Intermediate" as const,
      yearsOfExperience: 1,
    };
  });
}

export default function ProfilePage() {
  const { profile, profileId, loading } = useProfileContext();
  const [extended, setExtended] = useState<StudentProfileExtended | null>(null);
  const [ready, setReady] = useState(false);
  const [skillsSource, setSkillsSource] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!profileId) return;
    setExtended(mergeExtendedProfile(profile as ApiProfile | null));
    setSkillsSource((profile as ApiProfile & { skills_source?: string })?.skills_source);
    setReady(true);
  }, [profileId, profile]);

  useEffect(() => {
    if (!profileId || !extended) return;

    async function enrich() {
      try {
        const [interviews, practices] = await Promise.allSettled([
          getInterviewHistory(profileId!),
          getPracticeHistory(profileId!),
        ]);

        setExtended((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
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
          if (completedPractice > 0) {
            next.activity.learningHours = Math.max(next.activity.learningHours, completedPractice * 2);
          }
          return next;
        });
      } catch {
        /* keep defaults */
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

  const handleResumeUpload = useCallback(
    async (file: File) => {
      if (!profileId || !extended) return;
      const parsed = await uploadResume(file);
      const dreamJob = matchCareerRole(parsed.suggested_target_role) || extended.careerGoal.dreamJob;
      const next: StudentProfileExtended = {
        ...extended,
        personal: {
          ...extended.personal,
          fullName: parsed.full_name || extended.personal.fullName,
          email: parsed.email || extended.personal.email,
          phone: parsed.phone || extended.personal.phone,
        },
        careerGoal: {
          ...extended.careerGoal,
          dreamJob,
          careerObjective: parsed.summary || extended.careerGoal.careerObjective,
        },
        currentRole: dreamJob,
        skills: parsed.skills?.length ? mapParsedSkills(parsed.skills) : extended.skills,
        education: parsed.education?.length
          ? parsed.education.map((e: Record<string, string>, i: number) => ({
              id: `edu-${Date.now()}-${i}`,
              institution: e.institution || "",
              degree: e.degree || "",
              faculty: "",
              major: e.field || "",
              startDate: e.start_year || "",
              endDate: e.end_year || e.year || "",
              currentSemester: "",
              cgpa: e.gpa || "",
              description: "",
            }))
          : extended.education,
        experience: parsed.experience?.length
          ? parsed.experience.map((e: Record<string, string>, i: number) => ({
              id: `exp-${Date.now()}-${i}`,
              company: e.company || "",
              position: e.title || "",
              employmentType: "Full-time",
              location: "",
              startDate: e.start_date || "",
              endDate: e.end_date || "",
              description: e.description || "",
              technologies: [],
              achievements: [],
            }))
          : extended.experience,
        portfolio: {
          ...extended.portfolio,
          resumeFileName: file.name,
        },
        careerPreferences: {
          ...extended.careerPreferences,
          preferredRoles: [...new Set([dreamJob, ...extended.careerPreferences.preferredRoles])],
        },
      };
      setExtended(next);
      await flushExtendedProfile(profileId, next);
      await updateProfile(profileId, { skills_source: "cv" });
      setSkillsSource("cv");
    },
    [profileId, extended]
  );

  if (loading || !ready || !extended) {
    return <LoadingState label="Loading your profile..." />;
  }

  const apiProfile = profile as ApiProfile & { skills_source?: string };

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
      <PortfolioSection
        data={extended}
        onChange={persist}
        skillsSource={skillsSource || apiProfile?.skills_source}
        onResumeUpload={handleResumeUpload}
      />
      <CareerPreferencesSection data={extended} onChange={persist} />
      <ActivitySection data={extended} />
      <PrivacySection data={extended} onChange={persist} />
    </div>
  );
}
