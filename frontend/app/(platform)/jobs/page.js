import Icon from "@/components/ui/Icon";

const jobs = [
  {
    company: "Leapfrog Technology",
    letter: "L",
    title: "Senior Frontend Engineer",
    match: 96,
    location: "Kathmandu, NP",
    salary: "NPR 180k - 250k /mo",
    experience: "3+ years",
    missing: ["Docker"],
    insight: "Completing Docker Basics will increase your match from 84% to 93%.",
  },
  {
    company: "Fusemachines",
    letter: "F",
    title: "Frontend Developer (React)",
    match: 92,
    location: "Remote / Lalitpur",
    salary: "NPR 120k - 180k /mo",
    experience: "1-3 years",
    missing: ["Next.js SSR"],
    insight: "Completing the Next.js Workshop will make you an Excellent match.",
    highlight: true,
  },
  {
    company: "Cotiviti",
    letter: "C",
    title: "React Developer",
    match: 88,
    location: "Kathmandu, NP",
    salary: "NPR 100k - 150k /mo",
    experience: "2+ years",
    missing: ["TypeScript", "Testing"],
    insight: "Your TypeScript progress is on track — 2 more modules to unlock.",
  },
  {
    company: "Deerwalk",
    letter: "D",
    title: "Junior Frontend Developer",
    match: 94,
    location: "Lalitpur, NP",
    salary: "NPR 80k - 120k /mo",
    experience: "0-1 years",
    missing: [],
    insight: "You're an excellent match! Apply now to secure this opportunity.",
  },
];

export default function JobsPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Job Matches</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Continuously scanned from Nepal&apos;s job market with AI-powered
          compatibility scoring.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="flex gap-2 rounded-lg bg-surface-container-low p-1">
          <button
            type="button"
            className="rounded-md bg-white px-4 py-2 text-label-md font-bold text-primary shadow-sm"
          >
            Best Match
          </button>
          <button type="button" className="px-4 py-2 text-label-md text-secondary">
            Recent
          </button>
          <button type="button" className="px-4 py-2 text-label-md text-secondary">
            Saved
          </button>
        </div>
        <span className="ml-auto text-label-md text-secondary">
          42 jobs matching your profile
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {jobs.map((job) => (
          <div
            key={job.title}
            className="card-hover flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white transition-all"
          >
            <div className="flex-1 space-y-5 p-8">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-low text-2xl font-bold ${job.highlight ? "text-primary" : ""}`}
                  >
                    {job.letter}
                  </div>
                  <div>
                    <h3 className="text-headline-md font-bold">{job.title}</h3>
                    <p className="text-body-md text-secondary">{job.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-primary/10 px-4 py-1.5 text-headline-md font-bold text-primary">
                    {job.match}%
                  </span>
                  <p className="mt-1 text-label-sm uppercase text-secondary">
                    Match
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-label-md text-secondary">
                <span className="flex items-center gap-1.5">
                  <Icon name="location_on" size={18} />
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="payments" size={18} />
                  {job.salary}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="work_history" size={18} />
                  {job.experience}
                </span>
              </div>
              {job.missing.length > 0 && (
                <div className="space-y-2">
                  <p className="text-label-sm font-bold uppercase tracking-wider text-secondary">
                    Missing Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.missing.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-error/10 bg-error/5 px-3 py-1 text-label-md text-error"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-primary bg-surface-container-low p-4">
                <Icon name="auto_awesome" className="text-primary" filled />
                <p className="text-sm text-secondary">{job.insight}</p>
              </div>
            </div>
            <div className="flex gap-4 border-t border-outline-variant bg-surface-container-low/50 p-6">
              <button
                type="button"
                className="flex-1 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-container"
              >
                Apply Now
              </button>
              <button
                type="button"
                className="rounded-xl border border-outline-variant px-4 py-3 hover:bg-white"
              >
                <Icon name="bookmark" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
