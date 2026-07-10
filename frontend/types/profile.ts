export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type SkillCategory =
  | "Programming Languages"
  | "Frameworks"
  | "Libraries"
  | "Databases"
  | "Cloud"
  | "DevOps"
  | "AI"
  | "Soft Skills"
  | "Languages";

export interface PersonalInfo {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  province: string;
  country: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  faculty: string;
  major: string;
  startDate: string;
  endDate: string;
  currentSemester: string;
  cgpa: string;
  description: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  position: string;
  employmentType: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
  achievements: string[];
}

export interface CareerGoal {
  dreamJob: string;
  preferredIndustry: string;
  workStyle: "Remote" | "Hybrid" | "On-site";
  expectedSalary: string;
  preferredLocations: string[];
  careerObjective: string;
  targetCompanies: string[];
}

export interface SkillEntry {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  yearsOfExperience: number;
}

export interface ProjectEntry {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  githubUrl: string;
  liveUrl: string;
  images: string[];
  role: string;
  duration: string;
  featured: boolean;
}

export interface CertificationEntry {
  id: string;
  certificate: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
  credentialUrl: string;
  credentialId: string;
}

export interface PortfolioLinks {
  resumeFileName: string | null;
  portfolioUrl: string;
  github: string;
  linkedin: string;
  leetcode: string;
  kaggle: string;
  codeforces: string;
  hackerrank: string;
  medium: string;
  personalWebsite: string;
}

export interface CareerPreferences {
  expectedSalary: string;
  preferredLocations: string[];
  preferredRoles: string[];
  preferredCompanySize: string;
  internship: boolean;
  fullTime: boolean;
  contract: boolean;
  immediateAvailability: boolean;
}

export interface PrivacySettings {
  publicProfile: boolean;
  recruiterVisibility: boolean;
  resumeVisibility: boolean;
  universityVisibility: boolean;
}

export interface ActivityStats {
  learningHours: number;
  projectsCompleted: number;
  mockInterviews: number;
  applications: number;
  certificates: number;
  achievements: number;
}

export interface AiCareerSummary {
  jobReadiness: number;
  resumeScore: number;
  bestMatchingRole: string;
  topStrengths: string[];
  skillsToImprove: string[];
  estimatedJobReady: string;
  roadmapProgress: number;
  nextRecommendation: string;
}

export interface StudentProfileExtended {
  personal: PersonalInfo;
  university: string;
  currentRole: string;
  coverImage: string | null;
  avatarUrl: string | null;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  careerGoal: CareerGoal;
  skills: SkillEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  portfolio: PortfolioLinks;
  careerPreferences: CareerPreferences;
  privacy: PrivacySettings;
  activity: ActivityStats;
  aiSummary: AiCareerSummary;
}

export interface ApiProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  years_of_experience?: number | null;
  education?: Array<Record<string, unknown>>;
  experience?: Array<Record<string, unknown>>;
  skills?: string[];
  target_role?: string;
  location?: string | null;
  time_per_week?: number | null;
  budget?: string | null;
  profile_meta?: Partial<StudentProfileExtended>;
  settings_meta?: Record<string, unknown>;
}
