/** Casefold + collapse whitespace, mirrors the backend's normalize key shape. */
export function normalizeSkillKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

const CATEGORY_BY_SKILL = {
  python: "Programming Languages",
  javascript: "Programming Languages",
  typescript: "Programming Languages",
  java: "Programming Languages",
  html: "Programming Languages",
  css: "Programming Languages",
  fastapi: "Frameworks",
  react: "Frameworks",
  nextjs: "Frameworks",
  "next.js": "Frameworks",
  "node.js": "Frameworks",
  django: "Frameworks",
  flask: "Frameworks",
  postgresql: "Databases",
  mongodb: "Databases",
  mysql: "Databases",
  redis: "Databases",
  docker: "DevOps",
  kubernetes: "DevOps",
  aws: "Cloud",
  azure: "Cloud",
  tensorflow: "AI",
  pytorch: "AI",
  communication: "Soft Skills",
};

/** @param {string} name @returns {import("@/types/profile").SkillCategory} */
export function inferSkillCategory(name) {
  const key = normalizeSkillKey(name).replace(/\s+/g, "");
  return CATEGORY_BY_SKILL[key] || "Frameworks";
}

/**
 * @param {string} value
 * @param {{ aliasMap: Record<string, string>, allSkills: string[] }} catalog
 * @returns {string | null}
 */
export function resolveCatalogSkill(value, { aliasMap, allSkills }) {
  const key = normalizeSkillKey(value);
  if (!key) return null;

  if (aliasMap[key]) return aliasMap[key];

  const lowerSet = new Set(allSkills.map((s) => s.toLowerCase()));
  if (lowerSet.has(key)) {
    return allSkills.find((s) => s.toLowerCase() === key) || value.trim();
  }
  return null;
}

/**
 * @param {string} query
 * @param {string[]} allSkills
 * @param {Set<string>} [excludeLower]
 * @param {number} [limit]
 */
export function filterCatalogSkills(query, allSkills, excludeLower = new Set(), limit = 10) {
  const q = normalizeSkillKey(query);
  const pool = allSkills.filter((s) => !excludeLower.has(s.toLowerCase()));
  if (!q) return pool.slice(0, limit);
  return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, limit);
}
