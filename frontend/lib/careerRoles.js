/** Common career roles for Nepal — used in onboarding target-role picker. */
export const CAREER_ROLES = [
  // Software & engineering
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile App Developer",
  "DevOps Engineer",
  "QA / Test Engineer",
  "UI/UX Designer",
  "Product Manager",
  // AI / data
  "AI / ML Engineer",
  "Data Analyst",
  "Data Scientist",
  "Business Intelligence Analyst",
  // Marketing & growth
  "Digital Marketing Specialist",
  "Content Writer",
  "Social Media Manager",
  "SEO Specialist",
  "Brand Manager",
  // Finance & business
  "Accountant",
  "Financial Analyst",
  "Banking Officer",
  "Business Development Executive",
  // Sales & customer
  "Sales Executive",
  "Customer Success Manager",
  "Call Center Agent",
  // HR & admin
  "HR Officer",
  "Recruitment Specialist",
  "Office Administrator",
  // Healthcare & education
  "Staff Nurse",
  "Medical Lab Technician",
  "Pharmacist",
  "Teacher",
  "Lecturer",
  // Hospitality & operations
  "Hotel Management Trainee",
  "Chef / Cook",
  "Logistics Coordinator",
  "Supply Chain Analyst",
  // Other
  "Graphic Designer",
  "Video Editor",
  "Civil Engineer",
  "Architect",
  "Legal Associate",
];

/**
 * Map a free-text suggestion from CV parsing to the closest known role.
 * @param {string | null | undefined} suggestion
 */
export function matchCareerRole(suggestion) {
  if (!suggestion?.trim()) return "";
  const lower = suggestion.trim().toLowerCase();
  const exact = CAREER_ROLES.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;
  const contains = CAREER_ROLES.find(
    (r) => lower.includes(r.toLowerCase()) || r.toLowerCase().includes(lower)
  );
  if (contains) return contains;
  // keyword fallbacks
  const keywords = [
    { keys: ["frontend", "front-end", "react"], role: "Frontend Developer" },
    { keys: ["backend", "back-end", "api"], role: "Backend Developer" },
    { keys: ["full stack", "fullstack"], role: "Full Stack Developer" },
    { keys: ["data scien"], role: "Data Scientist" },
    { keys: ["data anal"], role: "Data Analyst" },
    { keys: ["machine learning", "ml ", " ai"], role: "AI / ML Engineer" },
    { keys: ["market"], role: "Digital Marketing Specialist" },
    { keys: ["nurse", "nursing"], role: "Staff Nurse" },
    { keys: ["account"], role: "Accountant" },
    { keys: ["sales"], role: "Sales Executive" },
    { keys: ["hr ", "human resource"], role: "HR Officer" },
    { keys: ["teacher", "teaching"], role: "Teacher" },
  ];
  for (const { keys, role } of keywords) {
    if (keys.some((k) => lower.includes(k))) return role;
  }
  return suggestion.trim();
}

/**
 * @param {string} query
 * @param {number} [limit]
 */
export function filterCareerRoles(query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return CAREER_ROLES.slice(0, limit);
  return CAREER_ROLES.filter((r) => r.toLowerCase().includes(q)).slice(0, limit);
}
