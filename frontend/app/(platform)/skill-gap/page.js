import Link from "next/link";
import Icon from "@/components/ui/Icon";

const currentSkills = [
  { icon: "data_object", name: "React & Next.js", level: "Expert", pct: 92 },
  { icon: "code", name: "TypeScript", level: "Advanced", pct: 85 },
  { icon: "palette", name: "Tailwind CSS", level: "Expert", pct: 95 },
];

const gaps = [
  {
    name: "Docker & Containerization",
    priority: "CRITICAL",
    priorityStyle: "bg-tertiary-fixed text-on-tertiary-fixed",
    border: "border-tertiary",
    desc: "Required for 88% of Senior Frontend job matches.",
    weeks: "4 Weeks",
    roi: "High ROI",
  },
  {
    name: "AWS Cloud Architecture",
    priority: "CRITICAL",
    priorityStyle: "bg-tertiary-fixed text-on-tertiary-fixed",
    border: "border-tertiary",
    desc: "Demand for Frontend Engineers with Cloud Infrastructure skills is up 40%.",
    weeks: "6 Weeks",
    roi: "High ROI",
  },
  {
    name: "CI/CD Pipelines",
    priority: "MEDIUM",
    priorityStyle: "bg-primary-fixed text-on-primary-fixed-variant",
    border: "border-primary",
    desc: "Essential for team leadership and automation workflows.",
    weeks: "3 Weeks",
  },
];

const marketTrends = [
  { name: "System Design", growth: "+24% Growth", pct: 88, color: "bg-tertiary" },
  { name: "State Management (Zustand)", growth: "+15% Growth", pct: 72, color: "bg-primary" },
  { name: "Web Performance", growth: "+12% Growth", pct: 65, color: "bg-primary" },
];

const matrix = [
  { name: "State Management", sub: "Redux, Zustand, Recoil", current: 75, required: 90, gap: "+15% Gap", urgent: false },
  { name: "Performance Opt.", sub: "Web Vitals, Memoization", current: 60, required: 85, gap: "+25% Gap", urgent: false },
  { name: "Testing Frameworks", sub: "Jest, Cypress, Playwright", current: 40, required: 80, gap: "+40% Gap", urgent: true },
  { name: "Architecture Patterns", sub: "Micro-frontends, Clean Arch", current: 30, required: 85, gap: "+55% Gap", urgent: true },
];

export default function SkillGapPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <div className="flex items-end justify-between">
          <div>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              Competency Analysis
            </span>
            <h2 className="text-display-lg text-on-surface">Skill Gap Analysis</h2>
            <p className="mt-2 max-w-2xl text-body-lg text-secondary">
              Visualizing your trajectory towards{" "}
              <span className="font-bold text-on-surface">
                Senior Frontend Developer
              </span>{" "}
              roles in the current market.
            </p>
          </div>
          <div className="text-right">
            <div className="text-headline-lg font-display-lg text-primary">74%</div>
            <div className="text-label-sm uppercase tracking-widest text-secondary">
              Market Readiness Score
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 items-start gap-8">
        <section className="col-span-12 space-y-6 mask-reveal lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Current Mastery</h3>
            <Icon name="verified" className="text-primary" />
          </div>
          {currentSkills.map((skill) => (
            <div
              key={skill.name}
              className="ambient-shadow group rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-xl bg-primary/5 p-3 text-primary">
                  <Icon name={skill.icon} />
                </div>
                <span className="rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-fixed-dim">
                  {skill.level}
                </span>
              </div>
              <h4 className="mb-2 text-label-md font-bold">{skill.name}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-label-sm text-secondary">
                  <span>Proficiency</span>
                  <span className="font-bold text-on-surface">{skill.pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${skill.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="relative col-span-12 overflow-hidden rounded-[32px] border border-outline-variant bg-surface-container-low p-8 mask-reveal lg:col-span-4">
          <div className="pointer-events-none absolute right-0 top-0 p-12 opacity-5">
            <Icon name="warning" size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="mb-2 text-headline-md text-on-surface">
              The Critical Gap
            </h3>
            <p className="mb-10 text-body-md text-secondary">
              High-priority skills missing for Senior Architect roles.
            </p>
            <div className="space-y-6">
              {gaps.map((gap) => (
                <div
                  key={gap.name}
                  className={`rounded-2xl border-l-4 bg-surface-container-lowest p-6 shadow-sm ${gap.border}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-label-md font-bold text-on-surface">
                      {gap.name}
                    </h4>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ${gap.priorityStyle}`}
                    >
                      {gap.priority}
                    </span>
                  </div>
                  <p className="mb-4 text-body-md text-secondary">{gap.desc}</p>
                  <div className="flex items-center gap-4 text-secondary">
                    <div className="flex items-center gap-1">
                      <Icon name="schedule" size={18} />
                      <span className="text-label-sm">{gap.weeks}</span>
                    </div>
                    {gap.roi && (
                      <div className="flex items-center gap-1">
                        <Icon name="trending_up" size={18} />
                        <span className="text-label-sm">{gap.roi}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/roadmap"
              className="mt-10 block w-full rounded-xl bg-primary py-4 text-center text-label-md font-bold text-white transition-all hover:shadow-lg active:scale-95"
            >
              Build Training Plan
            </Link>
          </div>
        </section>

        <section className="col-span-12 space-y-6 mask-reveal lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Market Pulse</h3>
            <Icon name="trending_up" className="text-secondary" />
          </div>
          <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
            <p className="mb-6 text-label-sm uppercase tracking-widest text-secondary">
              Trending Skills 2024
            </p>
            <div className="space-y-8">
              {marketTrends.map((t) => (
                <div key={t.name}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-label-md font-bold">{t.name}</span>
                    <span
                      className={`font-bold ${t.color === "bg-tertiary" ? "text-tertiary" : "text-primary"}`}
                    >
                      {t.growth}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${t.color}`}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 rounded-xl border border-dashed border-outline bg-surface-container-low p-6">
              <div className="flex items-start gap-4">
                <Icon name="tips_and_updates" className="text-primary" />
                <p className="text-body-md text-on-surface-variant">
                  <strong>AI Recommendation:</strong> Prioritize Docker before AWS.
                  Employers currently value local environment consistency higher
                  for senior roles.
                </p>
              </div>
            </div>
          </div>
          <div className="relative h-64 overflow-hidden rounded-2xl border border-outline-variant ambient-shadow bg-primary-fixed">
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-primary/20 to-transparent p-8">
              <div>
                <p className="text-headline-md font-bold leading-tight text-on-primary-fixed">
                  Projected Career Path
                </p>
                <p className="text-label-md text-on-surface-variant">
                  Based on 1.2M market data points
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-20 mask-reveal">
        <h3 className="mb-8 text-headline-md text-on-surface">
          Technical Proficiency Matrix
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {matrix.map((m) => (
            <div
              key={m.name}
              className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 transition-all hover:border-primary/50"
            >
              <h5 className="mb-1 text-label-md font-bold">{m.name}</h5>
              <p className="mb-4 text-label-sm text-secondary">{m.sub}</p>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${m.current}%` }}
                  />
                </div>
                <span className="text-label-sm font-bold">{m.current}%</span>
              </div>
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-secondary">Required: {m.required}%</span>
                <span
                  className={m.urgent ? "font-bold text-tertiary" : "text-primary"}
                >
                  {m.gap}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
