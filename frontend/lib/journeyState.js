/**
 * Shared journey state engine — single source of truth for "where am I?"
 * across the Dashboard, Journey, and QuickLinksRow.
 *
 * Pure function: given the dashboard aggregator payload, return a normalized
 * state object both pages consume. Dashboard and Journey therefore can never
 * disagree on completion %, next action, or step status.
 */

/** @typedef {'not_started'|'in_progress'|'complete'} StepStatus */

/**
 * @param {{
 *   gap?: any | null,
 *   gap_stale?: boolean,
 *   roadmap?: any | null,
 *   interviews?: any[],
 *   practices?: any[],
 *   applications?: any[],
 * }} input
 */
export function computeJourneyState({ gap, gap_stale, roadmap, interviews = [], practices = [], applications = [] }) {
  const hasGap = Boolean(gap);
  const hasCompletedInterview = interviews.some((s) => s.status === "completed");
  const hasCompletedPractice = practices.some((s) => s.status === "completed");

  const roadmapProgress = computeRoadmapProgress(roadmap);

  const steps = [
    {
      key: "profile",
      icon: "person",
      title: "Profile Created",
      status: /** @type {StepStatus} */ ("complete"),
      href: "/onboarding",
    },
    {
      key: "gap",
      icon: "insights",
      title: "Skill Gap Analyzed",
      status: hasGap ? "complete" : "not_started",
      href: "/skill-gap",
      detail: hasGap ? `${gap.gap_data?.readiness_score ?? 0}% readiness` : "Run your first analysis",
    },
    {
      key: "interview",
      icon: "record_voice_over",
      title: "Mock Interview Completed",
      status: hasCompletedInterview ? "complete" : "not_started",
      href: "/mock-interview",
      detail: hasCompletedInterview
        ? `Avg ${averageScore(interviews.filter((s) => s.status === "completed"))}/10`
        : "Validate your skills",
    },
    {
      key: "practice",
      icon: "sports_esports",
      title: "Skill Practice Verified",
      status: hasCompletedPractice ? "complete" : "not_started",
      href: "/practice",
      detail: hasCompletedPractice ? "Skills proven" : "Prove your strongest skills",
    },
    {
      key: "roadmap",
      icon: "route",
      title: "Roadmap In Progress",
      status: roadmapProgress.status,
      href: "/roadmap",
      detail: roadmap
        ? `${roadmapProgress.completedTasks}/${roadmapProgress.totalTasks} ${roadmapProgress.isPathBased ? "skills" : "tasks"}`
        : "Generate from your skill gap",
    },
    {
      key: "jobs",
      icon: "work",
      title: "Explore Job Matches",
      status: applications.length > 0 ? "in_progress" : "not_started",
      href: "/jobs",
      detail: applications.length > 0 ? `${applications.length} tracked` : "Browse matched roles",
    },
  ];

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const inProgressCount = steps.filter((s) => s.status === "in_progress").length;
  // Weighted completion: completed steps + half credit for in-progress ones,
  // so the bar reflects partial work (e.g. roadmap with some tasks done).
  const completionPct = Math.round(((completedCount + 0.5 * inProgressCount) / steps.length) * 100);

  const nextAction = computeNextAction({
    hasGap,
    gapStale: Boolean(gap_stale),
    hasCompletedInterview,
    hasCompletedPractice,
    roadmap,
    roadmapProgress,
  });

  return {
    steps,
    completionPct,
    completedCount,
    totalSteps: steps.length,
    nextAction,
    roadmapProgress,
    hasGap,
    hasCompletedInterview,
    hasCompletedPractice,
    readinessScore: gap?.gap_data?.readiness_score ?? null,
  };
}

const EMPTY_PROGRESS = {
  status: "not_started",
  completedTasks: 0,
  totalTasks: 0,
  pct: 0,
  currentWeek: null,
  nextTask: null,
  nextNode: null,
  isPathBased: false,
};

/**
 * Prefers the roadmap.sh-style skill path (`roadmap.path.phases[].nodes` +
 * `progress.completed_nodes`) when present; falls back to the legacy week
 * accordion for roadmaps generated before the path feature existed.
 * @param {{ path?: any, weeks?: any[], progress?: { completed?: any[], completed_nodes?: string[] } } | null} roadmap
 */
export function computeRoadmapProgress(roadmap) {
  if (!roadmap) return EMPTY_PROGRESS;

  if (Array.isArray(roadmap.path?.phases)) {
    const allNodes = roadmap.path.phases.flatMap((phase) => phase.nodes || []);
    const completedIds = new Set(roadmap.progress?.completed_nodes || []);
    const totalTasks = allNodes.length;
    const completedTasks = allNodes.filter((node) => completedIds.has(node.id)).length;
    const nextNode = allNodes.find((node) => !completedIds.has(node.id)) || null;
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const status = completedTasks === 0 ? "not_started" : completedTasks >= totalTasks ? "complete" : "in_progress";
    return { status, completedTasks, totalTasks, pct, currentWeek: null, nextTask: null, nextNode, isPathBased: true };
  }

  if (!Array.isArray(roadmap.weeks)) return EMPTY_PROGRESS;

  const completed = new Set(
    (roadmap.progress?.completed || []).map((e) => `${e.week}:${e.task_index}`)
  );
  let totalTasks = 0;
  let completedTasks = 0;
  let currentWeek = null;
  let nextTask = null;

  for (const week of roadmap.weeks) {
    const tasks = week.tasks || [];
    let doneInWeek = 0;
    for (let i = 0; i < tasks.length; i += 1) {
      totalTasks += 1;
      const isDone = completed.has(`${week.week}:${i}`);
      if (isDone) {
        doneInWeek += 1;
        completedTasks += 1;
      } else if (nextTask == null) {
        nextTask = { week: week.week, taskIndex: i, task: tasks[i] };
      }
    }
    if (currentWeek == null && doneInWeek < tasks.length && tasks.length > 0) {
      currentWeek = week;
    }
  }

  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const status = completedTasks === 0 ? "not_started" : completedTasks >= totalTasks ? "complete" : "in_progress";
  return { status, completedTasks, totalTasks, pct, currentWeek, nextTask, nextNode: null, isPathBased: false };
}

function computeNextAction({ hasGap, gapStale, hasCompletedInterview, hasCompletedPractice, roadmap, roadmapProgress }) {
  if (!hasGap) {
    return {
      key: "run_gap",
      label: "Run Skill Gap Analysis",
      description: "See exactly where you stand against the live Nepal job market.",
      href: "/skill-gap",
      priority: 1,
    };
  }
  if (gapStale) {
    return {
      key: "refresh_gap",
      label: "Refresh Skill Gap",
      description: "Your last analysis is over a week old — re-run to capture new postings and progress.",
      href: "/skill-gap",
      priority: 2,
    };
  }
  if (!hasCompletedInterview) {
    return {
      key: "interview",
      label: "Take Mock Interview",
      description: "Validate your skills in a real interview — it sharpens your readiness score.",
      href: "/mock-interview",
      priority: 3,
    };
  }
  if (!hasCompletedPractice) {
    return {
      key: "practice",
      label: "Verify Skills",
      description: "Run a practice session to prove your strongest skills with a passing challenge.",
      href: "/practice",
      priority: 4,
    };
  }
  if (roadmap && roadmapProgress.isPathBased && roadmapProgress.nextNode) {
    const node = roadmapProgress.nextNode;
    return {
      key: "continue_roadmap",
      label: `Learn next: ${node.title || node.skill}`,
      description: "Pick up your skill path where you left off.",
      href: "/roadmap",
      priority: 5,
    };
  }
  if (roadmap && roadmapProgress.nextTask) {
    const week = roadmapProgress.currentWeek?.week ?? roadmapProgress.nextTask.week;
    const task = roadmapProgress.nextTask.task;
    return {
      key: "continue_roadmap",
      label: `Continue Week ${week}: ${task.title || task.skill || "next task"}`,
      description: "Pick up your roadmap where you left off.",
      href: "/roadmap",
      priority: 5,
    };
  }
  return {
    key: "explore_jobs",
    label: "Explore Job Matches",
    description: "Your profile is in strong shape — check the latest roles matched to you.",
    href: "/jobs",
    priority: 6,
  };
}

function averageScore(sessions) {
  const scores = sessions.map((s) => s.overall_score).filter((v) => v != null);
  if (!scores.length) return "—";
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}
