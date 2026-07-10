import { apiUrl, ApiError } from "@/lib/api";

const ADMIN_KEY_STORAGE = "disha_admin_key";

export function getStoredAdminKey() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
}

export function storeAdminKey(key) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

/** Fetch wrapper for /api/admin/* — attaches X-Admin-Key from sessionStorage. */
export async function adminFetch(path, options = {}) {
  const { json, headers, ...rest } = options;
  const key = getStoredAdminKey();

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
