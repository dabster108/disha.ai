/** First-load skeleton shaped like the real hero + priority list, so the
 * page doesn't jump layout once data arrives. Only shown when there's no
 * cached snapshot at all — a re-run keeps the real content visible. */
export default function SkillGapSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="mb-16">
        <div className="mb-6 h-3 w-64 rounded bg-surface-container-high" />
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
          <div className="h-[168px] w-[168px] shrink-0 rounded-full bg-surface-container-high" />
          <div className="flex w-full flex-1 flex-col items-center gap-3 md:items-start">
            <div className="h-8 w-56 rounded bg-surface-container-high" />
            <div className="h-4 w-72 rounded bg-surface-container-high" />
            <div className="mt-3 h-11 w-40 rounded-xl bg-surface-container-high" />
          </div>
        </div>
      </div>
      <div className="mb-4 h-6 w-72 rounded bg-surface-container-high" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-container-high" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}
