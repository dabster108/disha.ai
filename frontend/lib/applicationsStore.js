/**
 * Lightweight localStorage-backed job tracker (MVP per spec — future: DB).
 * Shared by the Applications page and the dashboard's JobMatchCard "save"
 * button so a job saved from the dashboard immediately appears in Applications.
 */

const KEY = "disha-applications";

const STATUSES = ["saved", "viewed", "applied", "interview", "offer", "rejected"];

/** @typedef {{ id: string, title: string, company: string, location?: string, source_url?: string, match_score?: number, match_label?: string, status: string, savedAt: string, updatedAt: string }} TrackedJob */

function read() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("disha-applications-changed"));
}

/** @returns {TrackedJob[]} */
export function loadTrackedJobs() {
  return read().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** @param {object} job — a job match from the API */
export function saveJob(job) {
  const items = read();
  const id = job.id || `${job.title}|${job.company}`;
  if (items.some((j) => j.id === id)) return loadTrackedJobs();
  const now = new Date().toISOString();
  items.push({
    id,
    title: job.title,
    company: job.company,
    location: job.location || null,
    source_url: job.source_url || null,
    match_score: job.match_score,
    match_label: job.match_label || null,
    status: "saved",
    savedAt: now,
    updatedAt: now,
  });
  write(items);
  return loadTrackedJobs();
}

export function removeJob(id) {
  write(read().filter((j) => j.id !== id));
  return loadTrackedJobs();
}

export function setJobStatus(id, status) {
  const items = read().map((j) =>
    j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j
  );
  write(items);
  return loadTrackedJobs();
}

export function isJobSaved(id) {
  return read().some((j) => j.id === id);
}

export const APPLICATION_STATUSES = STATUSES;

/** Subscribe to tracker changes (cross-tab + same-tab). Returns an unsubscribe fn. */
export function subscribeTrackedJobs(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback(loadTrackedJobs());
  window.addEventListener("disha-applications-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("disha-applications-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
