const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** @param {string} path */
export function apiUrl(path) {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function extractErrorMessage(body, fallback) {
  const detail = body?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return fallback;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Central fetch wrapper. Sends/parses JSON by default; pass a FormData body
 * to send multipart instead (Content-Type is left for the browser to set).
 * @param {string} path
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function apiFetch(path, options = {}) {
  const { json, headers, body, ...rest } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(apiUrl(path), {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : body,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(isFormData ? {} : headers),
      ...(isFormData ? headers : {}),
    },
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, `Request failed (${response.status})`),
      response.status,
      data
    );
  }
  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const checkHealth = () => apiFetch("/health");

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** @param {File} file */
export function uploadResume(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/api/profile/upload-resume", { method: "POST", body: form });
}

/** @param {object} payload */
export function createProfile(payload) {
  return apiFetch("/api/profile", { method: "POST", json: payload });
}

/** @param {string} profileId */
export function getProfile(profileId) {
  return apiFetch(`/api/profile/${profileId}`);
}

// ---------------------------------------------------------------------------
// Interview
// ---------------------------------------------------------------------------

export const startInterview = (profileId) =>
  apiFetch("/api/interview/start", { method: "POST", json: { profile_id: profileId } });

export const answerInterview = (sessionId, answer) =>
  apiFetch("/api/interview/answer", {
    method: "POST",
    json: { session_id: sessionId, answer },
  });

export const getInterviewHistory = (profileId) =>
  apiFetch(`/api/interview/${profileId}/history`);

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

export const suggestPracticeSkills = (profileId) =>
  apiFetch("/api/practice/skills/suggest", { method: "POST", json: { profile_id: profileId } });

export const startPractice = (profileId, skills, difficulty = "auto") =>
  apiFetch("/api/practice/start", {
    method: "POST",
    json: { profile_id: profileId, skills, difficulty },
  });

/** payload: { challenge_id, code?, explanation?, answer? } */
export const submitPractice = (sessionId, payload) =>
  apiFetch(`/api/practice/${sessionId}/submit`, { method: "POST", json: payload });

export const getPracticeSession = (sessionId) => apiFetch(`/api/practice/${sessionId}`);

export const getPracticeHistory = (profileId) =>
  apiFetch(`/api/practice/history/${profileId}`);

// ---------------------------------------------------------------------------
// Skill gap
// ---------------------------------------------------------------------------

/** opts: { interview_session_id?, practice_session_id?, include_narrative?, run_roadmap?, n_jobs? } */
export const runSkillGap = (profileId, opts = {}) =>
  apiFetch("/api/gap", { method: "POST", json: { profile_id: profileId, ...opts } });

export const getLatestGap = (profileId) => apiFetch(`/api/gap/${profileId}`);

export const getGapHistory = (profileId, limit = 10) =>
  apiFetch(`/api/gap/${profileId}/history?limit=${limit}`);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** @param {string} profileId @param {{ n?: number }} [opts] */
export const matchJobs = (profileId, opts = {}) =>
  apiFetch("/api/jobs/match", {
    method: "POST",
    json: { profile_id: profileId, ...opts },
  });

export const getJobMatches = (profileId, n) =>
  apiFetch(`/api/jobs/match/${profileId}${n ? `?n=${n}` : ""}`);

export const getJobCorpusStatus = () => apiFetch("/api/jobs/status");

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

/** opts: { snapshot_id?, force_replan? } */
export const createRoadmap = (profileId, opts = {}) =>
  apiFetch("/api/roadmap", { method: "POST", json: { profile_id: profileId, ...opts } });

export const getLatestRoadmap = (profileId) => apiFetch(`/api/roadmap/${profileId}`);

/** Toggle a whole task, or a single resource when resourceIndex is provided. */
export const updateRoadmapProgress = (profileId, week, taskIndex, completed, resourceIndex = null) =>
  apiFetch(`/api/roadmap/${profileId}/progress`, {
    method: "PATCH",
    json: {
      week,
      task_index: taskIndex,
      completed,
      ...(resourceIndex != null ? { resource_index: resourceIndex } : {}),
    },
  });

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

export async function synthesizeSpeech(text) {
  const form = new FormData();
  form.append("text", text);
  const response = await fetch(apiUrl("/api/voice/tts"), { method: "POST", body: form });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(data, "Voice synthesis failed"), response.status, data);
  }
  const provider = response.headers.get("X-TTS-Provider");
  const blob = await response.blob();
  return { blob, provider };
}

/** @param {Blob} audioBlob */
export function transcribeAudio(audioBlob) {
  const form = new FormData();
  form.append("file", audioBlob, "recording.webm");
  return apiFetch("/api/voice/stt", { method: "POST", body: form });
}

/** 404 is a common, expected response (no gap/roadmap/session yet). */
export function isNotFound(error) {
  return error instanceof ApiError && error.status === 404;
}
