/**
 * Plain-language framing derived from data the API already returns
 * (readiness_score, evidence.checklist) — no new fields, no backend change.
 */

/** @param {number} score */
export function readinessStatus(score) {
  const pct = score ?? 0;
  if (pct >= 75) return "Market-aligned";
  if (pct >= 40) return "Almost job-ready";
  return "Building foundation";
}

/** One-line "what would raise accuracy" tip from the existing checklist, or
 * null when every signal is already complete. */
export function accuracyTip(evidence) {
  const next = (evidence?.checklist || []).find((item) => !item.done);
  if (!next) return null;
  return `${next.label} to raise accuracy`;
}
