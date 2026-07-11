/** Pure helpers to normalize roadmap API data for the canvas UI layer. */

export const NODE_STATUS = {
  COMPLETED: "completed",
  ACTIVE: "active",
  UPCOMING: "upcoming",
  LOCKED: "locked",
};

const TASK_TYPE_ICON = {
  course: "play_circle",
  project: "terminal",
  practice: "fitness_center",
};

const SKILL_ICON = "school";

export function taskTypeIcon(type) {
  return TASK_TYPE_ICON[type] || SKILL_ICON;
}

export function isTaskDone(progress, week, taskIndex) {
  return (progress?.completed || []).some((e) => e.week === week && e.task_index === taskIndex);
}

export function isResourceDone(progress, week, taskIndex, resourceIndex) {
  return (progress?.resources_completed || []).some(
    (e) => e.week === week && e.task_index === taskIndex && e.resource_index === resourceIndex
  );
}

function deriveLegacyTaskStatus(progress, week, taskIndex, isCurrent) {
  if (isTaskDone(progress, week, taskIndex)) return NODE_STATUS.COMPLETED;
  if (isCurrent) return NODE_STATUS.ACTIVE;
  return NODE_STATUS.UPCOMING;
}

/** @returns {{ sections: Array, nodes: Array, stats: object }} */
export function buildPathCanvasModel(path, progress) {
  const completedIds = new Set(progress?.completed_nodes || []);
  const autoByNode = new Map((progress?.auto_completed || []).map((e) => [e.node_id, e]));
  const sections = [];
  const nodes = [];
  let globalIndex = 0;

  for (const phase of path?.phases || []) {
    const sectionNodes = [];
    for (const node of phase.nodes || []) {
      const status = node.status || NODE_STATUS.UPCOMING;
      const item = {
        key: node.id,
        id: node.id,
        globalIndex,
        sectionId: phase.id,
        sectionTitle: phase.title,
        title: node.title || node.skill,
        description: node.description || "",
        skill: node.skill,
        type: "skill",
        icon: SKILL_ICON,
        status,
        resources: node.resources || [],
        autoCompleted: autoByNode.get(node.id) || null,
        estimatedMinutes: 45,
        xp: 50,
        meta: { pathNode: true },
        isCompleted: status === NODE_STATUS.COMPLETED || completedIds.has(node.id),
      };
      sectionNodes.push(item);
      nodes.push(item);
      globalIndex += 1;
    }
    if (sectionNodes.length) {
      sections.push({ id: phase.id, title: phase.title, nodes: sectionNodes });
    }
  }

  return { sections, nodes, stats: computeStats(nodes) };
}

/** @returns {{ sections: Array, nodes: Array, stats: object }} */
export function buildLegacyCanvasModel(weeks, progress) {
  const sections = [];
  const nodes = [];
  let globalIndex = 0;
  let foundActive = false;

  for (const week of weeks || []) {
    const sectionNodes = [];
    week.tasks?.forEach((task, taskIndex) => {
      const done = isTaskDone(progress, week.week, taskIndex);
      const isCurrent = !foundActive && !done;
      if (isCurrent) foundActive = true;
      const status = deriveLegacyTaskStatus(progress, week.week, taskIndex, isCurrent);
      const hoursPerTask = week.hours && week.tasks?.length ? Math.round(week.hours / week.tasks.length) : null;
      const item = {
        key: `w${week.week}-t${taskIndex}`,
        id: `week-${week.week}-task-${taskIndex}`,
        globalIndex,
        sectionId: `week-${week.week}`,
        sectionTitle: `Week ${week.week}`,
        title: task.title,
        description: task.skill ? `Focus: ${task.skill}` : "",
        skill: task.skill,
        type: task.type || "course",
        icon: taskTypeIcon(task.type),
        status,
        resources: task.resources || [],
        autoCompleted: null,
        estimatedMinutes: hoursPerTask ? hoursPerTask * 60 : 30,
        xp: 40,
        meta: {
          legacy: true,
          week: week.week,
          weekTheme: week.theme,
          taskIndex,
          weekHours: week.hours,
        },
        isCompleted: done,
      };
      sectionNodes.push(item);
      nodes.push(item);
      globalIndex += 1;
    });
    if (sectionNodes.length) {
      sections.push({
        id: `week-${week.week}`,
        title: week.theme ? `Week ${week.week} · ${week.theme}` : `Week ${week.week}`,
        nodes: sectionNodes,
      });
    }
  }

  return { sections, nodes, stats: computeStats(nodes) };
}

function computeStats(nodes) {
  const total = nodes.length;
  const completed = nodes.filter((n) => n.isCompleted).length;
  const remaining = total - completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const current = nodes.find((n) => n.status === NODE_STATUS.ACTIVE) || nodes.find((n) => !n.isCompleted);
  const estimatedRemainingMin = nodes
    .filter((n) => !n.isCompleted)
    .reduce((sum, n) => sum + (n.estimatedMinutes || 30), 0);

  return {
    total,
    completed,
    remaining,
    pct,
    currentMilestone: current?.sectionTitle || current?.title || "Getting started",
    currentTitle: current?.title || "",
    estimatedRemainingMin,
    estimatedRemainingLabel: formatMinutes(estimatedRemainingMin),
  };
}

export function formatMinutes(minutes) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
