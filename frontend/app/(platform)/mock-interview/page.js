import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

const history = [
  {
    title: "Frontend Lead @ TechCorp",
    date: "Oct 12, 2023 • Technical Session",
    score: "84%",
    active: true,
  },
  {
    title: "SDE II Mock Simulation",
    date: "Sept 28, 2023 • Cultural Round",
    score: "72%",
  },
];

const tips = [
  {
    category: "Technical Strategy",
    title: "Master System Design",
    description:
      "Learn how to articulate high-level architecture decisions for large-scale distributed frontend systems.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAXtPc2QuzMCMmkP4xjZyU1bFfOMq6NPfAy2W_tD-0flPEmvjmGdLcgtc43BypW-NhD1Z8hPIGZSzm0lfoZIlbeWOcFJlNe1J54Io40bW0Lst7mocB9uAgvJuNzm98IVrxCkSGj9GOjxmg_03UIaXs2BhWRh12S9VpSiU3klrFHJm8t3IVp4sd8GCOIH464ZyQlMi6lIPR7iSG5H4IURtgXOo48-AzCYvNc1a20bkb4wdq1Ej4-97naGg",
    color: "text-primary",
  },
  {
    category: "Communication",
    title: "Behavioral Frameworks",
    description:
      "Utilizing the STAR method to demonstrate leadership and conflict resolution in high-pressure teams.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA0ryQF8F1H8miNL03w_gJX2pBof7pX2SP3HJMdCUB2wUDn6bUKfISAHmlgnw3zsOu0T6Nci6TMpPTD1K-4KbtdtCr_FbgKQ4vXfCZAwNXN0CURKhbb2eFtBjBJwCEOtqLmzNmxiFCl6t2EIy--DLW5AinaWd7eke4A7pcRmZKEO-rS5Dks7RFpy8CLcpplXZ9uBlvvOADP4l_RWFi3Xdmjg2U-bGSHxoE1z96wHOUAZtxCrWnJiMGhIg",
    color: "text-tertiary",
  },
];

export default function MockInterviewPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-margin-desktop pb-20 pt-24">
      <div className="mb-12 mask-reveal">
        <nav className="mb-2 flex items-center gap-2 text-secondary">
          <span className="text-label-sm uppercase tracking-widest">Workspace</span>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm uppercase tracking-widest text-on-surface">
            Mock Interview Simulation
          </span>
        </nav>
        <h1 className="text-display-lg tracking-tight text-on-surface">
          Mock Interview Simulation
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Refine your technical communication and leadership presence with
          AI-powered behavioral and technical stress tests.
        </p>
      </div>

      <section className="mb-section-gap grid grid-cols-12 gap-gutter">
        <div className="col-span-12 flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-white ambient-shadow mask-reveal md:flex-row lg:col-span-8">
          <div className="flex flex-1 flex-col justify-between p-10">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-full bg-error-container px-3 py-1 text-label-sm text-on-error-container">
                  EXPERT LEVEL
                </span>
                <span className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-label-sm text-secondary">
                  <Icon name="schedule" size={14} />
                  45 Minutes
                </span>
              </div>
              <h2 className="mb-2 text-headline-lg text-on-surface">
                Senior Frontend Engineer
              </h2>
              <p className="mb-8 text-body-md text-on-secondary-container">
                This session focuses on Distributed Systems at the Edge,
                Advanced React Patterns, and System Design for Scalable Web
                Applications.
              </p>
              <div className="mb-10 grid grid-cols-2 gap-8">
                <div>
                  <h4 className="mb-2 text-label-sm uppercase text-secondary">
                    Focus Areas
                  </h4>
                  <ul className="space-y-1">
                    {[
                      "Next.js 14 Architecture",
                      "Performance Profiling",
                      "Team Leadership",
                    ].map((area) => (
                      <li
                        key={area}
                        className="flex items-center gap-2 text-body-md text-on-surface"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-label-sm uppercase text-secondary">
                    Type
                  </h4>
                  <p className="text-body-md text-on-surface">
                    Technical + Cultural Alignment
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/mock-interview/active"
              className="w-full rounded-xl bg-primary px-10 py-4 text-center text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary-container active:scale-95 md:w-fit"
            >
              Start Simulation
            </Link>
          </div>
          <div className="group relative w-full overflow-hidden bg-surface-container-low md:w-72">
            <Image
              className="h-full w-full object-cover opacity-60 grayscale transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-5YDddqPlDdhUROCfBNnodCQxhWD2t_4zKFbwO_UXO-zmhzH3Q0luNwcXChJAQj7t3YFCjqoAbN4TdQWtQ9wNU0nIMxpjgLxX6bHUaUI5HUX2kcZQmTSV9E52TujGnPhoTGcmE4mD2iTv4jQvXXhUdif3CnWO6YhWC5OP86U5wSAiEyfn1IkudhM8jaEqlUMNl9VrIQ9kc7IPMp7V-KCLUsc2oFS0Bnm_72HifKpHpeVsu209eiGGEA"
              alt="Professional workspace"
              width={288}
              height={400}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          </div>
        </div>

        <div className="col-span-12 grid grid-rows-2 gap-gutter mask-reveal lg:col-span-4">
          <div className="rounded-xl border border-outline-variant bg-white p-8 ambient-shadow">
            <h4 className="mb-4 text-label-md font-bold text-on-surface">
              Preparation Readiness
            </h4>
            {[
              { label: "Core Concepts", pct: 92 },
              { label: "Soft Skills", pct: 68 },
            ].map((item, i) => (
              <div key={item.label} className={i === 0 ? "mb-6" : ""}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-sm font-bold text-primary">
                    {item.pct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="mt-6 text-xs italic text-secondary">
              DISHA suggests focusing on &apos;Conflict Resolution&apos; during
              this session.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-primary-container p-8 text-on-primary-container ambient-shadow">
            <div className="relative z-10">
              <Icon name="bolt" className="mb-4 text-3xl" />
              <h4 className="mb-2 text-headline-md font-bold">AI Coach Active</h4>
              <p className="text-body-md opacity-90">
                Real-time sentiment analysis and technical accuracy tracking are
                enabled for this session.
              </p>
            </div>
            <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-section-gap">
        <div className="col-span-12 space-y-section-gap lg:col-span-8">
          <section className="mask-reveal">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-headline-md font-bold text-on-surface">
                Interview History
              </h3>
              <Link
                href="/mock-interview/report"
                className="text-label-md text-primary hover:underline"
              >
                View All Sessions
              </Link>
            </div>
            <div className="space-y-4">
              {history.map((item) => (
                <Link
                  key={item.title}
                  href="/mock-interview/report"
                  className="group flex cursor-pointer items-center justify-between rounded-xl border border-outline-variant bg-white p-5 transition-colors hover:border-primary"
                >
                  <div className="flex items-center gap-6">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low transition-colors ${item.active ? "text-primary group-hover:bg-primary-fixed" : "text-secondary"}`}
                    >
                      <Icon name="description" />
                    </div>
                    <div>
                      <p className="text-body-md font-bold text-on-surface">
                        {item.title}
                      </p>
                      <p className="text-sm text-secondary">{item.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-on-surface">
                      {item.score}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary">
                      Overall Score
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mask-reveal">
            <div className="mb-8">
              <h3 className="text-headline-md font-bold text-on-surface">
                Improvement Trends
              </h3>
              <p className="text-sm text-secondary">
                Your performance growth over the last 6 simulations.
              </p>
            </div>
            <div className="relative flex h-64 items-end justify-between rounded-xl border border-outline-variant bg-white p-10 ambient-shadow">
              <svg
                className="absolute inset-x-10 inset-y-16 h-32 w-[calc(100%-80px)] overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 600 100"
              >
                <path
                  d="M0,80 Q100,70 200,90 T400,40 T600,10"
                  fill="none"
                  stroke="#0050cb"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
                <circle cx="0" cy="80" fill="#0050cb" r="4" />
                <circle cx="600" cy="10" fill="#0050cb" r="4" />
              </svg>
              <div className="mt-auto flex w-full justify-between">
                {["SESSION 1", "SESSION 2", "SESSION 3", "SESSION 4", "SESSION 5", "CURRENT"].map(
                  (s, i) => (
                    <span
                      key={s}
                      className={`text-xs font-bold ${i === 5 ? "text-primary" : "text-secondary"}`}
                    >
                      {s}
                    </span>
                  )
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <section className="mask-reveal">
            <h3 className="mb-8 text-headline-md font-bold text-on-surface">
              Preparation Tips
            </h3>
            <div className="space-y-6">
              {tips.map((tip) => (
                <div key={tip.title} className="group cursor-pointer">
                  <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl border border-outline-variant">
                    <Image
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      src={tip.image}
                      alt={tip.title}
                      width={400}
                      height={225}
                    />
                  </div>
                  <span
                    className={`mb-1 block text-label-sm font-bold uppercase ${tip.color}`}
                  >
                    {tip.category}
                  </span>
                  <h4 className="text-body-lg font-bold text-on-surface transition-colors group-hover:text-primary">
                    {tip.title}
                  </h4>
                  <p className="mt-2 line-clamp-2 text-sm text-secondary">
                    {tip.description}
                  </p>
                </div>
              ))}
              <div className="mt-8 rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
                <p className="mb-4 text-label-md text-on-surface">
                  Want more specialized practice?
                </p>
                <button
                  type="button"
                  className="w-full rounded-lg border border-outline bg-white py-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
                >
                  Browse Question Bank
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
