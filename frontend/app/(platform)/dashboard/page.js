"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";

const stats = [
  { icon: "analytics", label: "Progress", value: "68%", color: "text-primary", bg: "bg-primary/5", extra: "progress" },
  { icon: "timeline", label: "Roadmap", value: "Week 5", color: "text-tertiary", bg: "bg-tertiary/5", sub: "Frontend Engineering" },
  { icon: "psychology", label: "Skill Gap", value: "7 Skills", color: "text-secondary", bg: "bg-secondary/5", sub: "Required for Seniority" },
  { icon: "work", label: "Job Matches", value: "42 Jobs", color: "text-on-secondary-fixed-variant", bg: "bg-secondary-fixed", sub: "Across top platforms" },
];

const tasks = [
  { title: "Advanced React Patterns", subtitle: "Compound components & Render Props" },
  { title: "Unit Testing with Jest", subtitle: "Mocking API calls and components" },
  { title: "Responsive UI Design Lab", subtitle: "Implementing Container Queries" },
];

const companies = [
  { name: "Leapfrog", letter: "L", match: "96%" },
  { name: "Cotiviti", letter: "C", match: "88%" },
  { name: "Fusemachines", letter: "F", match: "92%", highlight: true },
  { name: "Google", letter: "G", match: "64%" },
  { name: "Microsoft", letter: "M", match: "58%" },
];

const jobs = [
  {
    company: "Leapfrog Technology",
    letter: "L",
    title: "Senior Frontend Engineer",
    match: "96%",
    location: "Kathmandu, NP",
    salary: "NPR 180k - 250k /mo",
    missing: ["Docker", "CI/CD Pipelines"],
    insight:
      "Because you're completing React Hooks this week, your match score is expected to increase to 98%.",
  },
  {
    company: "Fusemachines",
    letter: "F",
    title: "Frontend Developer (React)",
    match: "92%",
    location: "Remote / Lalitpur",
    salary: "NPR 120k - 180k /mo",
    missing: ["Next.js SSR"],
    insight:
      "Completing the Next.js Workshop will make you an Excellent match for this role.",
    highlight: true,
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 p-12">
      <section className="mask-reveal">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-headline-md text-secondary">
              Good morning, Pratik 👋
            </p>
            <h2 className="max-w-3xl text-display-lg">
              You&apos;re <span className="text-primary">68% ready</span> for your
              first Frontend Role.
            </h2>
          </div>
          <Link
            href="/journey"
            className="flex h-fit items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-95"
          >
            Continue Journey
            <Icon name="arrow_forward" />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-hover rounded-2xl border border-outline-variant bg-white p-6 transition-all"
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                className={`rounded-lg p-2 ${stat.bg} ${stat.color}`}
              >
                <Icon name={stat.icon} />
              </span>
              <span className="text-label-sm uppercase tracking-wider text-secondary">
                {stat.label}
              </span>
            </div>
            <div className="text-headline-lg font-bold">{stat.value}</div>
            {stat.extra === "progress" ? (
              <div className="mt-4 h-1.5 w-full rounded-full bg-surface-container-low">
                <div className="h-full w-[68%] rounded-full bg-primary" />
              </div>
            ) : (
              <div className="mt-4 text-label-md text-secondary">{stat.sub}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-md">Today&apos;s Mission</h3>
            <span className="rounded-full bg-primary/10 px-4 py-1.5 text-label-md font-bold text-primary">
              3 Tasks Remaining
            </span>
          </div>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.title}
                className="group flex cursor-pointer items-center rounded-xl border border-outline-variant bg-white p-5 transition-all hover:border-primary"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-outline-variant transition-colors group-hover:border-primary">
                  <div className="h-3 w-3 scale-50 rounded-full bg-primary opacity-0 transition-all group-hover:scale-100 group-hover:opacity-10" />
                </div>
                <div className="ml-4 flex-1">
                  <h4 className="text-body-md font-bold text-on-surface">
                    {task.title}
                  </h4>
                  <p className="text-label-sm text-secondary">{task.subtitle}</p>
                </div>
                <Icon
                  name="arrow_forward"
                  className="text-secondary transition-all group-hover:translate-x-1 group-hover:text-primary"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#003fa4] p-8 text-white">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="mb-6 flex items-center gap-3">
              <Icon name="auto_awesome" />
              <span className="text-label-sm font-bold uppercase tracking-widest">
                AI Insight
              </span>
            </div>
            <div className="flex-1">
              <h3 className="mb-4 text-headline-md font-bold leading-tight">
                Boost your career potential instantly
              </h3>
              <p className="mb-8 text-body-md text-white/80">
                Completing{" "}
                <span className="font-bold text-white underline decoration-secondary-fixed">
                  Docker Basics
                </span>{" "}
                will boost your match score for top-tier companies from 68% to
                82%.
              </p>
            </div>
            <Link
              href="/roadmap"
              className="w-full rounded-xl bg-white py-4 text-center font-bold text-primary transition-all hover:bg-surface-container-lowest"
            >
              Start Skill Path
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-headline-md">Target Match Score</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-outline-variant p-2 transition-colors hover:bg-surface-container-low"
            >
              <Icon name="chevron_left" />
            </button>
            <button
              type="button"
              className="rounded-full border border-outline-variant p-2 transition-colors hover:bg-surface-container-low"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
        <div className="hide-scrollbar flex gap-6 overflow-x-auto pb-4">
          {companies.map((c) => (
            <div
              key={c.name}
              className="flex w-48 shrink-0 flex-col items-center rounded-2xl border border-outline-variant bg-white p-6"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-xl font-bold ${c.highlight ? "text-primary" : ""}`}
              >
                {c.letter}
              </div>
              <div className="mb-1 text-label-md font-bold">{c.name}</div>
              <div className="text-headline-md font-bold text-primary">
                {c.match}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="mb-2 text-headline-md">Job Matches For You</h3>
            <p className="text-body-md text-secondary">
              Personalized recommendations based on your evolving skill profile.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-2 rounded-lg bg-surface-container-low p-1">
              <button
                type="button"
                className="rounded-md bg-white px-4 py-2 text-label-md font-bold text-primary shadow-sm"
              >
                Recommended
              </button>
              <button
                type="button"
                className="px-4 py-2 text-label-md text-secondary"
              >
                Recent
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {jobs.map((job) => (
            <div
              key={job.title}
              className="card-hover flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white transition-all"
            >
              <div className="flex-1 space-y-6 p-8">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-low text-2xl font-bold ${job.highlight ? "text-primary" : ""}`}
                    >
                      {job.letter}
                    </div>
                    <div>
                      <h4 className="text-headline-md font-bold">{job.title}</h4>
                      <p className="text-body-md text-secondary">{job.company}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="rounded-full bg-primary/10 px-4 py-1.5 text-headline-md font-bold text-primary">
                      {job.match}
                    </span>
                    <span className="mt-1 text-label-sm uppercase text-secondary">
                      Match
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-label-md text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Icon name="location_on" size={20} />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="payments" size={20} />
                    {job.salary}
                  </span>
                </div>
                <div className="space-y-3">
                  <p className="text-label-sm font-bold uppercase tracking-wider text-secondary">
                    Missing Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.missing.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-error/10 bg-error/5 px-3 py-1 text-label-md text-error"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-xl border-l-4 border-primary bg-surface-container-low p-4">
                  <Icon name="auto_awesome" className="text-primary" filled />
                  <p className="text-sm leading-relaxed text-secondary">
                    {job.insight}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 border-t border-outline-variant bg-surface-container-low/50 p-6">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-primary py-3.5 font-bold text-white transition-all hover:bg-primary-container"
                >
                  Apply Now
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-outline-variant px-4 py-3.5 transition-all hover:bg-white"
                >
                  <Icon name="bookmark" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="rounded-2xl border border-outline-variant bg-white p-8 lg:col-span-8">
            <h4 className="mb-6 text-headline-md font-bold">Match Distribution</h4>
            <div className="mb-6 flex h-32 items-end gap-2">
              {[
                { label: "Excellent", height: "40%", color: "bg-primary/10" },
                { label: "Good", height: "80%", color: "bg-primary/20" },
                { label: "Needs Imp.", height: "30%", color: "bg-surface-container-high" },
              ].map((bar) => (
                <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t-lg ${bar.color}`}
                    style={{ height: bar.height }}
                  />
                  <span className="text-label-sm text-secondary">{bar.label}</span>
                </div>
              ))}
            </div>
            <p className="text-body-md text-secondary">
              Most jobs in your current skill set fall under &quot;Good&quot;.
              Unlock 3 more skills to move them into &quot;Excellent&quot;.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-tertiary-fixed bg-[#fff6f4] p-8 text-center lg:col-span-4">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-fixed">
              <Icon name="notifications_active" className="text-3xl text-tertiary" />
            </div>
            <h4 className="mb-2 text-headline-md">Weekly Opportunity</h4>
            <p className="mb-6 text-body-md text-secondary">
              There are{" "}
              <span className="font-bold text-tertiary">34 new Frontend jobs</span>{" "}
              posted this week matching your profile.
            </p>
            <Link href="/jobs" className="font-bold text-tertiary hover:underline">
              View All New Openings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
