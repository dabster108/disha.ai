/** Max interview turns — mirrors backend MAX_QUESTION_TURNS. */
export const INTERVIEW_MAX_TURNS = 4;

export const INTERVIEW_DURATION_OPTIONS = [5, 10, 15, 30];

const TECH_ROLES = new Set([
  "backend developer",
  "frontend developer",
  "full stack developer",
  "python developer",
  "ml engineer",
  "machine learning engineer",
  "data scientist",
  "data analyst",
  "software engineer",
  "devops engineer",
  "qa engineer",
]);

const TECH_SKILL_HINTS = new Set([
  "python",
  "javascript",
  "typescript",
  "react",
  "node",
  "sql",
  "java",
  "django",
  "fastapi",
  "docker",
  "aws",
  "machine learning",
  "pandas",
  "tensorflow",
]);

/** @param {{ target_role?: string, skills?: string[] }} profile */
export function inferInterviewTrack(profile) {
  const role = (profile?.target_role || "").toLowerCase();
  if (TECH_ROLES.has(role)) return "tech";

  const skills = (profile?.skills || []).map((s) => s.toLowerCase());
  if (skills.some((skill) => [...TECH_SKILL_HINTS].some((hint) => skill.includes(hint)))) {
    return "tech";
  }
  return "nontech";
}

/** @param {{ years_of_experience?: number | null }} profile */
export function suggestInterviewDifficulty(profile) {
  const years = profile?.years_of_experience ?? 0;
  if (years < 1) return "easy";
  if (years < 3) return "medium";
  return "hard";
}

export const INTERVIEW_DURATION_KEY_PREFIX = "disha-interview-duration-";
export const INTERVIEW_PREFS_KEY_PREFIX = "disha-interview-prefs-";

/** @param {string} sessionId @param {{ minutes: number, difficulty?: string }} prefs */
export function storeInterviewSessionPrefs(sessionId, prefs) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `${INTERVIEW_DURATION_KEY_PREFIX}${sessionId}`,
    JSON.stringify({ minutes: prefs.minutes })
  );
  if (prefs.difficulty) {
    sessionStorage.setItem(
      `${INTERVIEW_PREFS_KEY_PREFIX}${sessionId}`,
      JSON.stringify({ difficulty: prefs.difficulty })
    );
  }
}

/** @param {string} sessionId */
export function loadInterviewSessionPrefs(sessionId) {
  if (typeof window === "undefined") {
    return { minutes: 15, difficulty: null };
  }

  let minutes = 15;
  let difficulty = null;

  const durationRaw = sessionStorage.getItem(`${INTERVIEW_DURATION_KEY_PREFIX}${sessionId}`);
  if (durationRaw) {
    try {
      minutes = JSON.parse(durationRaw).minutes ?? 15;
    } catch {
      // ignore
    }
  }

  const prefsRaw = sessionStorage.getItem(`${INTERVIEW_PREFS_KEY_PREFIX}${sessionId}`);
  if (prefsRaw) {
    try {
      difficulty = JSON.parse(prefsRaw).difficulty ?? null;
    } catch {
      // ignore
    }
  }

  return { minutes, difficulty };
}
