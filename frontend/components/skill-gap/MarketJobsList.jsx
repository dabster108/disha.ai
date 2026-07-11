/**
 * "Proof from real postings" — visually quieter than Learn Next, since this
 * is supporting evidence, not the primary action. External links are kept
 * here (market proof) — a different case from the Learning panel, which
 * never leaves the app.
 */
export default function MarketJobsList({ jobs = [] }) {
  return (
    <section className="mb-16 mask-reveal">
      <h2 className="text-headline-md text-on-surface">Jobs this is based on</h2>
      <p className="mt-1 text-body-md text-secondary">Real Nepal postings behind this analysis.</p>

      {jobs.length === 0 ? (
        <p className="mt-4 text-sm text-secondary">No matching jobs found yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {jobs.map((job, i) => (
            <a
              key={`${job.title}-${job.company}-${i}`}
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-outline-variant/60 bg-white p-4 transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-label-md font-bold text-on-surface group-hover:text-primary">
                    {job.title}
                  </p>
                  <p className="text-sm text-secondary">{job.company}</p>
                </div>
                {job.match_score != null && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                    {job.match_score}%
                  </span>
                )}
              </div>
              {job.matched_skills?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.matched_skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="rounded-full bg-surface-container-low px-2 py-0.5 text-[11px] font-medium text-secondary">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
