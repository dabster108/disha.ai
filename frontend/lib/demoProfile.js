/** Pre-filled demo profile for onboarding — no CV upload required. */
export const DEMO_PROFILE = {
  full_name: "Aayush Shrestha",
  email: "aayush.shrestha@example.com",
  phone: "+977 9841234567",
  summary:
    "CSIT graduate with internship experience building React dashboards and REST APIs.",
  years_of_experience: 1.5,
  skills: [
    "Python",
    "JavaScript",
    "React",
    "SQL",
    "Git",
    "HTML",
    "CSS",
    "FastAPI",
  ],
  education: [
    {
      degree: "BSc CSIT",
      institution: "Tribhuvan University",
      year: "2024",
    },
  ],
  experience: [
    {
      title: "Junior Developer Intern",
      company: "Leapfrog Technology",
      start_date: "Jan 2024",
      end_date: "Jun 2024",
      description: "Built internal React dashboards and REST API integrations.",
    },
  ],
  suggested_target_role: "Frontend Developer",
  target_role: "Frontend Developer",
  location: "Kathmandu",
  time_per_week: 15,
  budget: "free",
};

export const EMPTY_EDUCATION = { degree: "", institution: "", year: "" };

export const EMPTY_EXPERIENCE = {
  title: "",
  company: "",
  start_date: "",
  end_date: "",
  description: "",
};

/** Suggested skill chips beyond parsed CV skills (quick add). */
export const SUGGESTED_SKILL_CHIPS = [
  "Communication",
  "Teamwork",
  "Problem Solving",
  "Git",
  "Excel",
  "English",
];
