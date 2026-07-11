const CONFIDENCE_STYLE = {
  high: { cls: "bg-green-100 text-green-700", label: "High" },
  medium: { cls: "bg-primary/10 text-primary", label: "Medium" },
  low: { cls: "bg-tertiary-fixed text-on-tertiary-fixed", label: "Low" },
};

/** Small confidence pill — shared by the skill-gap page and dashboard snapshot. */
export default function ConfidenceBadge({ level }) {
  const style = CONFIDENCE_STYLE[level] || CONFIDENCE_STYLE.low;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.cls}`}>
      {style.label}
    </span>
  );
}
