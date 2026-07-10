import type { ApiProfile, StudentProfileExtended } from "@/types/profile";
import { updateProfile } from "@/lib/api";

const STORAGE_PREFIX = "disha-profile-extended-";

export function createDefaultExtended(api?: ApiProfile | null): StudentProfileExtended {
  const name = api?.full_name || "";
  const email = api?.email || "";
  const phone = api?.phone || "";
  const role = api?.target_role || "Software Developer";
  const location = api?.location || "";

  return {
    personal: {
      fullName: name,
      username: name ? name.toLowerCase().replace(/\s+/g, ".") : "",
      email,
      phone,
      dateOfBirth: "",
      gender: "",
      address: "",
      city: location.split(",")[0]?.trim() || "",
      province: "",
      country: "Nepal",
    },
    university: "",
    currentRole: role,
    coverImage: null,
    avatarUrl: null,
    education: mapEducation(api?.education),
    experience: mapExperience(api?.experience),
    careerGoal: {
      dreamJob: role,
      preferredIndustry: "",
      workStyle: "Hybrid",
      expectedSalary: "",
      preferredLocations: location ? [location.split(",")[0] || location] : [],
      careerObjective: api?.summary || "",
      targetCompanies: [],
    },
    skills: mapSkills(api?.skills),
    projects: [],
    certifications: [],
    portfolio: {
      resumeFileName: null,
      portfolioUrl: "",
      github: "",
      linkedin: "",
      leetcode: "",
      kaggle: "",
      codeforces: "",
      hackerrank: "",
      medium: "",
      personalWebsite: "",
    },
    careerPreferences: {
      expectedSalary: "",
      preferredLocations: location ? [location.split(",")[0] || location] : [],
      preferredRoles: role ? [role] : [],
      preferredCompanySize: "",
      internship: false,
      fullTime: true,
      contract: false,
      immediateAvailability: true,
    },
    privacy: {
      publicProfile: true,
      recruiterVisibility: true,
      resumeVisibility: true,
      universityVisibility: false,
    },
    activity: {
      learningHours: 0,
      projectsCompleted: 0,
      mockInterviews: 0,
      applications: 0,
      certificates: 0,
      achievements: 0,
    },
    aiSummary: {
      jobReadiness: 0,
      resumeScore: 0,
      bestMatchingRole: role,
      topStrengths: api?.skills?.slice(0, 3) || [],
      skillsToImprove: [],
      estimatedJobReady: "—",
      roadmapProgress: 0,
      nextRecommendation: "Run a skill gap analysis to get personalized recommendations.",
    },
  };
}

function mapEducation(raw?: Array<Record<string, unknown>>) {
  if (!raw?.length) return [];
  return raw.map((e, i) => ({
    id: `edu-${i}`,
    institution: String(e.institution || e.school || ""),
    degree: String(e.degree || ""),
    faculty: String(e.faculty || ""),
    major: String(e.field || e.major || ""),
    startDate: String(e.start_year || e.startDate || ""),
    endDate: String(e.end_year || e.endDate || ""),
    currentSemester: String(e.current_semester || ""),
    cgpa: String(e.gpa || e.cgpa || ""),
    description: String(e.description || ""),
  }));
}

function mapExperience(raw?: Array<Record<string, unknown>>) {
  if (!raw?.length) return [];
  return raw.map((e, i) => ({
    id: `exp-${i}`,
    company: String(e.company || ""),
    position: String(e.title || e.position || ""),
    employmentType: String(e.employment_type || e.employmentType || "Full-time"),
    location: String(e.location || ""),
    startDate: String(e.start_date || e.startDate || ""),
    endDate: String(e.end_date || e.endDate || ""),
    description: String(e.description || ""),
    technologies: Array.isArray(e.technologies) ? e.technologies.map(String) : [],
    achievements: Array.isArray(e.achievements) ? e.achievements.map(String) : [],
  }));
}

function mapSkills(raw?: string[]) {
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
      id: `skill-${i}`,
      name,
      category: categories[key] || "Frameworks",
      level: "Intermediate",
      yearsOfExperience: 1,
    } as import("@/types/profile").SkillEntry;
  });
}

export function mergeExtendedProfile(api?: ApiProfile | null): StudentProfileExtended {
  const base = createDefaultExtended(api);
  const meta = api?.profile_meta;
  if (!meta || typeof meta !== "object") return base;
  return { ...base, ...meta };
}

export function loadExtendedProfile(profileId: string | null, api?: ApiProfile | null): StudentProfileExtended {
  const merged = mergeExtendedProfile(api);
  if (!profileId || typeof window === "undefined") return merged;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${profileId}`);
    if (!raw) return merged;
    return { ...merged, ...JSON.parse(raw) };
  } catch {
    return merged;
  }
}

function extendedToApiPayload(data: StudentProfileExtended) {
  return {
    full_name: data.personal.fullName || null,
    email: data.personal.email || null,
    phone: data.personal.phone || null,
    target_role: data.careerGoal.dreamJob || data.currentRole,
    location: data.personal.city || null,
    summary: data.careerGoal.careerObjective || null,
    skills: data.skills.map((s) => s.name),
    education: data.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      faculty: e.faculty,
      field: e.major,
      start_year: e.startDate,
      end_year: e.endDate,
      gpa: e.cgpa,
      description: e.description,
    })),
    experience: data.experience.map((e) => ({
      company: e.company,
      title: e.position,
      employment_type: e.employmentType,
      location: e.location,
      start_date: e.startDate,
      end_date: e.endDate,
      description: e.description,
      technologies: e.technologies,
      achievements: e.achievements,
    })),
    profile_meta: data,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveExtendedProfile(profileId: string, data: StudentProfileExtended) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(data));
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    updateProfile(profileId, extendedToApiPayload(data)).catch(() => {
      /* keep local copy; user can retry on next edit */
    });
  }, 600);
}

export async function flushExtendedProfile(profileId: string, data: StudentProfileExtended) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(data));
  }
  return updateProfile(profileId, extendedToApiPayload(data));
}
