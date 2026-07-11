import Icon from "@/components/ui/Icon";

/**
 * Demoted from a full 4-stat-box band to a short callout — and only renders
 * at all when there's something worth explaining (postings were actually
 * excluded, or there are concrete differentiation examples). Most students
 * won't see this section.
 */
export default function RoleFitPanel({ roleFit }) {
  if (!roleFit) return null;
  const {
    target_role,
    role_category,
    jobs_considered,
    jobs_qualified,
    excluded_for_role_mismatch,
    differentiation_examples = [],
  } = roleFit;

  if (!excluded_for_role_mismatch && differentiation_examples.length === 0) return null;

  return (
    <section className="mb-16 mask-reveal rounded-xl border border-outline-variant bg-white p-6">
      <div className="flex items-start gap-3">
        <Icon name="rule" size={20} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-label-md font-bold text-on-surface">
            {excluded_for_role_mismatch} of {jobs_considered} postings excluded for {target_role}
            {role_category && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                {role_category}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-secondary">
            Adjacent titles and generic keywords (AI, Manager, Developer) don&apos;t inflate your {jobs_qualified}-job match.
          </p>
          {differentiation_examples.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {differentiation_examples.map((ex, i) => (
                <p key={`${ex.title}-${i}`} className="flex items-start gap-2 text-sm text-on-surface-variant">
                  <Icon name="block" size={14} className="mt-0.5 shrink-0 text-secondary" />
                  <span>
                    <span className="font-semibold text-on-surface">{ex.title}</span> — {ex.reason}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
