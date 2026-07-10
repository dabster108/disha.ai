import { apiUrl, ApiError } from "@/lib/api";

// Dev/local convenience only — bundled into client JS via NEXT_PUBLIC_*, so
// this is not real access control. The backend's require_admin dependency
// (checking the same value server-side) is what actually protects
// /api/admin/*; this just means /admin doesn't need a login screen locally.
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

/** Fetch wrapper for /api/admin/* — attaches X-Admin-Key from env automatically. */
export async function adminFetch(path, options = {}) {
  const { json, headers, ...rest } = options;
  const key = ADMIN_KEY;

  const response = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": key,
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // no JSON body
    }
    const message = body?.detail || `Request failed (${response.status})`;
    throw new ApiError(typeof message === "string" ? message : "Request failed", response.status, body);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const getAdminStats = () => adminFetch("/api/admin/stats");

export const getAdminUsers = (opts = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", opts.limit);
  if (opts.q) params.set("q", opts.q);
  const qs = params.toString();
  return adminFetch(`/api/admin/users${qs ? `?${qs}` : ""}`);
};

export const getAdminUserDossier = (profileId) => adminFetch(`/api/admin/users/${profileId}`);

export const updateVerification = (profileId, status, notes) =>
  adminFetch(`/api/admin/users/${profileId}/verification`, {
    method: "PATCH",
    json: { status, notes },
  });

export const triggerScrape = (payload) =>
  adminFetch("/api/admin/scrape", { method: "POST", json: payload });

export const getScrapeRuns = (limit = 20) => adminFetch(`/api/admin/scrape/runs?limit=${limit}`);

export const getSourceRanking = () => adminFetch("/api/admin/scrape/sources/ranking");

function withProfileFilter(path, opts = {}) {
  const params = new URLSearchParams();
  if (opts.profileId) params.set("profile_id", opts.profileId);
  if (opts.limit) params.set("limit", opts.limit);
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}`;
}

export const getAdminInterviews = (opts = {}) => adminFetch(withProfileFilter("/api/admin/interviews", opts));

export const getAdminInterview = (sessionId) => adminFetch(`/api/admin/interviews/${sessionId}`);

export const getAdminPractice = (opts = {}) => adminFetch(withProfileFilter("/api/admin/practice", opts));

export const getAdminGaps = (opts = {}) => adminFetch(withProfileFilter("/api/admin/gaps", opts));

export const getAdminRoadmaps = (opts = {}) => adminFetch(withProfileFilter("/api/admin/roadmaps", opts));

export const getAdminLearning = (opts = {}) => adminFetch(withProfileFilter("/api/admin/learning", opts));
