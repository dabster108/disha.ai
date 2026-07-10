import type { ApiProfile, StudentProfileExtended } from "@/types/profile";

const STORAGE_PREFIX = "disha-profile-extended-";

export function createDefaultExtended(api?: ApiProfile | null): StudentProfileExtended {
  const name = api?.full_name || "Pratik Sharma";
  const email = api?.email || "pratik.sharma@example.com";
  const phone = api?.phone || "+977 9801234567";
  const role = api?.target_role || "Backend Developer";
  const location = api?.location || "Kathmandu, Nepal";

  return {
    personal: {
      fullName: name,
      username: name.toLowerCase().replace(/\s+/g, "."),
      email,
      phone,
      dateOfBirth: "2001-08-15",
      gender: "Male",
      address: "Baluwatar, Ward 4",
      city: "Kathmandu",
      province: "Bagmati",
      country: "Nepal",
    },
    university: "Kathmandu University",
    currentRole: role,
    coverImage: null,
    avatarUrl: null,
    education: mapEducation(api?.education),
    experience: mapExperience(api?.experience),
    careerGoal: {
      dreamJob: role,
      preferredIndustry: "Technology / Software",
      workStyle: "Hybrid",
      expectedSalary: "NPR 80,000 – 120,000 / month",
      preferredLocations: [location.split(",")[0] || "Kathmandu", "Remote"],
      careerObjective:
        "Build scalable backend systems for Nepal's growing tech sector while contributing to open-source and mentoring junior developers.",
      targetCompanies: ["F1Soft", "Verisk Nepal", "CloudFactory", "Remote-first startups"],
    },
    skills: mapSkills(api?.skills),
    projects: [
      {
        id: "proj-1",
        title: "DISHA Career Platform API",
        description: "FastAPI backend with skill-gap analysis, job matching via Chroma, and voice interview orchestration.",
        technologies: ["Python", "FastAPI", "PostgreSQL", "ChromaDB"],
        githubUrl: "https://github.com/example/disha-api",
        liveUrl: "",
        images: [],
        role: "Backend Lead",
        duration: "Jan 2025 – Present",
        featured: true,
      },
      {
        id: "proj-2",
        title: "Nepal Job Scraper Pipeline",
        description: "Hybrid scraper ingesting postings from KamKhoj, MeroJob, and KumariJob with deduplication.",
        technologies: ["Python", "Playwright", "Crawl4AI"],
        githubUrl: "https://github.com/example/nepal-jobs",
        liveUrl: "",
        images: [],
        role: "Solo Developer",
        duration: "Nov 2024 – Feb 2025",
        featured: false,
      },
    ],
    certifications: [
      {
        id: "cert-1",
        certificate: "AWS Cloud Practitioner",
        organization: "Amazon Web Services",
        issueDate: "2024-06-01",
        expiryDate: "2027-06-01",
        credentialUrl: "https://aws.amazon.com/verification",
        credentialId: "AWS-CP-2024-XXXX",
      },
    ],
    portfolio: {
      resumeFileName: null,
      portfolioUrl: "https://pratik.dev",
      github: "https://github.com/pratiksharma",
      linkedin: "https://linkedin.com/in/pratiksharma",
      leetcode: "https://leetcode.com/pratiksharma",
      kaggle: "",
      codeforces: "",
      hackerrank: "https://hackerrank.com/pratiksharma",
      medium: "",
      personalWebsite: "https://pratik.dev",
    },
    careerPreferences: {
      expectedSalary: "NPR 80,000 – 120,000 / month",
      preferredLocations: ["Kathmandu", "Remote"],
      preferredRoles: [role, "Full Stack Developer"],
      preferredCompanySize: "50–500 employees",
      internship: false,
      fullTime: true,
      contract: true,
      immediateAvailability: true,
    },
    privacy: {
      publicProfile: true,
      recruiterVisibility: true,
      resumeVisibility: true,
      universityVisibility: false,
    },
    activity: {
      learningHours: 42,
      projectsCompleted: 2,
      mockInterviews: 1,
      applications: 0,
      certificates: 1,
      achievements: 3,
    },
    aiSummary: {
      jobReadiness: 58,
      resumeScore: 72,
      bestMatchingRole: "Full Stack Developer",
      topStrengths: ["Python", "FastAPI", "PostgreSQL"],
      skillsToImprove: ["Docker", "AWS", "System Design"],
      estimatedJobReady: "8–10 weeks",
      roadmapProgress: 12,
      nextRecommendation: "Complete Week 2 Docker fundamentals and take a mock interview to verify backend skills.",
    },
  };
}

function mapEducation(raw?: Array<Record<string, unknown>>) {
  if (!raw?.length) {
    return [
      {
        id: "edu-1",
        institution: "Kathmandu University",
        degree: "Bachelor of Engineering",
        faculty: "School of Engineering",
        major: "Computer Science",
        startDate: "2020-09",
        endDate: "2024-06",
        currentSemester: "",
        cgpa: "3.6",
        description: "Focus on algorithms, databases, and software engineering.",
      },
    ];
  }
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
  if (!raw?.length) {
    return [
      {
        id: "exp-1",
        company: "OrchidX Labs",
        position: "Backend Intern",
        employmentType: "Internship",
        location: "Kathmandu",
        startDate: "2024-01",
        endDate: "2024-08",
        description: "Built REST APIs and integrated PostgreSQL for internal tools.",
        technologies: ["Python", "FastAPI", "PostgreSQL"],
        achievements: ["Reduced API response time by 30%"],
      },
    ];
  }
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
  const list = raw?.length ? raw : ["Python", "FastAPI", "JavaScript", "PostgreSQL", "React", "Docker"];
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
  return list.map((name, i) => {
    const key = name.toLowerCase().replace(/\s+/g, "");
    return {
      id: `skill-${i}`,
      name,
      category: categories[key] || "Frameworks",
      level: i < 2 ? "Advanced" : "Intermediate",
      yearsOfExperience: i < 2 ? 2 : 1,
    } as import("@/types/profile").SkillEntry;
  });
}

export function loadExtendedProfile(profileId: string | null, api?: ApiProfile | null): StudentProfileExtended {
  const base = createDefaultExtended(api);
  if (!profileId || typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${profileId}`);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveExtendedProfile(profileId: string, data: StudentProfileExtended) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(data));
}
