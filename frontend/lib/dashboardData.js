/**
 * Dashboard data layer — wraps the aggregator endpoint and exposes typed
 * selectors used by the dashboard and journey pages. Keeps React components
 * free of data-shape knowledge so the backend remains the single source of
 * truth for completion/readiness/next-action logic.
 */

import { getDashboard } from "@/lib/api";
import { computeJourneyState, computeRoadmapProgress } from "@/lib/journeyState";

/** @returns {Promise<{ data: any, error: any | null }>} */
export async function loadDashboard(profileId) {
  if (!profileId) return { data: null, error: null };
  try {
    const data = await getDashboard(profileId);
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Compute the unified journey state from the aggregator payload. */
export function selectJourneyState(data) {
  if (!data) return null;
  return computeJourneyState({
    gap: data.gap,
    gap_stale: data.gap_stale,
    roadmap: data.roadmap,
    interviews: data.interviews || [],
    practices: data.practices || [],
    applications: [], // applications live in localStorage for now; wired by the page
  });
}

/** Readiness trend across gap history (oldest → newest). */
export function selectReadinessTrend(data) {
  if (!data?.gap_history?.length) return [];
  return [...data.gap_history]
    .reverse()
    .map((s) => ({ at: s.created_at, score: s.gap_data?.readiness_score }))
    .filter((p) => p.score != null);
}

/** Readiness delta (first → last). */
export function selectReadinessDelta(data) {
  const trend = selectReadinessTrend(data);
  if (trend.length < 2) return null;
  return trend[trend.length - 1].score - trend[0].score;
}

export function selectPrioritySkills(data) {
  return (data?.gap?.gap_data?.priority_learn || []).slice(0, 3);
}

export function selectStrongSkills(data) {
  const gapData = data?.gap?.gap_data;
  if (!gapData) return [];
  const verified = (gapData.verified_strong_skills || []).slice(0, 4).map((s) => ({
    skill: s.skill,
    score: s.score,
    source: s.source,
    verified: true,
  }));
  if (verified.length >= 4) return verified;
  const matched = (gapData.matched_skills || [])
    .filter((m) => !verified.some((v) => v.skill === m.skill))
    .slice(0, 4 - verified.length)
    .map((m) => ({ skill: m.skill, jobs_requiring: m.jobs_requiring, verified: false }));
  return [...verified, ...matched];
}

export function selectMissingSkills(data) {
  return (data?.gap?.gap_data?.market_missing_skills || []).slice(0, 3);
}

export function selectValidationConfidence(data) {
  const level = data?.gap?.gap_data?.evidence?.accuracy_level;
  return level ? level.toLowerCase() : null; // 'high' | 'medium' | 'low' | null
}

export function selectRoadmapState(data) {
  return computeRoadmapProgress(data?.roadmap || null);
}

export function selectJobMatches(data) {
  return (data?.job_matches || []).slice(0, 4);
}

export function selectLatestInterview(data) {
  const completed = (data?.interviews || []).filter((s) => s.status === "completed");
  return completed[0] || null;
}

export function selectLatestPractice(data) {
  const completed = (data?.practices || []).filter((s) => s.status === "completed");
  return completed[0] || null;
}

export function selectInterviewAverage(data) {
  const scores = (data?.interviews || [])
    .filter((s) => s.status === "completed" && s.overall_score != null)
    .map((s) => s.overall_score);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function selectPracticeAverage(data) {
  const scores = (data?.practices || [])
    .filter((s) => s.status === "completed" && s.overall_score != null)
    .map((s) => s.overall_score);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Completed interview scores over time (oldest → newest). */
export function selectInterviewTrend(data) {
  return (data?.interviews || [])
    .filter((s) => s.status === "completed" && s.overall_score != null)
    .slice()
    .reverse()
    .map((s) => ({
      at: s.finished_at || s.started_at,
      score: s.overall_score,
      label: new Date(s.finished_at || s.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }));
}

/** Completed practice scores over time (oldest → newest). */
export function selectPracticeTrend(data) {
  return (data?.practices || [])
    .filter((s) => s.status === "completed" && s.overall_score != null)
    .slice()
    .reverse()
    .map((s) => ({
      at: s.finished_at || s.started_at,
      score: s.overall_score,
      label: new Date(s.finished_at || s.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }));
}

/** Market match ratio trend from gap history (oldest → newest). */
export function selectMatchRatioTrend(data) {
  if (!data?.gap_history?.length) return [];
  return [...data.gap_history]
    .reverse()
    .map((s) => ({
      at: s.created_at,
      score: Math.round((s.match_ratio || 0) * 100),
      label: new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
}

/** Skill inventory breakdown for analytics charts. */
export function selectSkillBreakdown(data) {
  const g = data?.gap?.gap_data;
  if (!g) return null;
  const matched = g.matched_skills?.length || 0;
  const strong = g.verified_strong_skills?.length || 0;
  const weak = g.verified_weak_skills?.length || 0;
  const missing = g.market_missing_skills?.length || 0;
  const priority = g.priority_learn?.length || 0;
  return {
    matched,
    strong,
    weak,
    missing,
    priority,
    total: matched + missing,
  };
}

/** Unified recent-activity feed (newest first). */
export function selectActivityFeed(data) {
  const items = [];

  for (const s of data?.gap_history || []) {
    const score = s.gap_data?.readiness_score;
    items.push({
      type: "gap",
      at: s.created_at,
      title: "Skill gap analysis",
      detail: score != null ? `${Math.round(score)}% readiness` : "Analysis completed",
      score,
      href: "/skill-gap",
      icon: "insights",
    });
  }

  for (const s of (data?.interviews || []).filter((i) => i.status === "completed")) {
    items.push({
      type: "interview",
      at: s.finished_at || s.started_at,
      title: "Mock interview",
      detail: s.overall_score != null ? `Score ${s.overall_score}/10` : "Completed",
      score: s.overall_score,
      href: `/mock-interview/report?session=${s.id}`,
      icon: "record_voice_over",
    });
  }

  for (const s of (data?.practices || []).filter((p) => p.status === "completed")) {
    items.push({
      type: "practice",
      at: s.finished_at || s.started_at,
      title: "Skill practice",
      detail:
        s.overall_score != null
          ? `${(s.skills_selected || []).join(", ")} — ${s.overall_score}/10`
          : (s.skills_selected || []).join(", "),
      score: s.overall_score,
      href: "/practice",
      icon: "sports_esports",
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
}

/** High-level analytics summary for the dashboard hero stats. */
export function selectAnalyticsSummary(data) {
  const interviews = (data?.interviews || []).filter((s) => s.status === "completed");
  const practices = (data?.practices || []).filter((s) => s.status === "completed");
  const interviewScores = interviews.map((s) => s.overall_score).filter((s) => s != null);
  const practiceScores = practices.map((s) => s.overall_score).filter((s) => s != null);

  return {
    gapRuns: data?.gap_history?.length || 0,
    interviewCount: interviews.length,
    practiceCount: practices.length,
    interviewBest: interviewScores.length ? Math.max(...interviewScores) : null,
    practiceBest: practiceScores.length ? Math.max(...practiceScores) : null,
    interviewAvg: interviewScores.length
      ? interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length
      : null,
    practiceAvg: practiceScores.length
      ? practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length
      : null,
    matchRatio: data?.gap?.match_ratio != null ? Math.round(data.gap.match_ratio * 100) : null,
    jobsAnalyzed: data?.gap?.jobs_analyzed || 0,
  };
}

/** Score delta for interview trend (first → last). */
export function selectInterviewDelta(data) {
  const trend = selectInterviewTrend(data);
  if (trend.length < 2) return null;
  return trend[trend.length - 1].score - trend[0].score;
}

/** Score delta for practice trend (first → last). */
export function selectPracticeDelta(data) {
  const trend = selectPracticeTrend(data);
  if (trend.length < 2) return null;
  return trend[trend.length - 1].score - trend[0].score;
}
