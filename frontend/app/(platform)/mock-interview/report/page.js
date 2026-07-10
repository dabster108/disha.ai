import Link from "next/link";
import Icon from "@/components/ui/Icon";

const dimensions = [
  { label: "Technical Knowledge", score: 82, color: "text-primary" },
  { label: "Communication", score: 88, color: "text-primary" },
  { label: "Confidence", score: 75, color: "text-tertiary" },
  { label: "Answer Structure", score: 80, color: "text-primary" },
  { label: "Problem Solving", score: 78, color: "text-primary" },
  { label: "Cultural Fit", score: 85, color: "text-primary" },
];

const highlights = [
  {
    type: "strength",
    title: "Strong React Fundamentals",
    text: "Demonstrated deep understanding of component lifecycle and state management patterns.",
  },
  {
    type: "improve",
    title: "System Design Depth",
    text: "Consider expanding answers to include scalability trade-offs and distributed system considerations.",
  },
  {
    type: "improve",
    title: "Filler Words",
    text: "Detected 12 instances of 'um' and 'like' — practice pausing instead of filler words.",
  },
];

export default function InterviewReportPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <nav className="mb-4 flex items-center gap-2 text-secondary">
          <Link href="/mock-interview" className="text-label-sm hover:text-primary">
            Mock Interview
          </Link>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm text-on-surface">Performance Report</span>
        </nav>
        <div className="flex items-end justify-between">
          <div>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              Session Complete
            </span>
            <h1 className="text-display-lg text-on-surface">
              Interview Performance Report
            </h1>
            <p className="mt-2 text-body-lg text-secondary">
              Senior Frontend Engineer • Oct 12, 2024 • 42 minutes
            </p>
          </div>
          <div className="text-center">
            <div className="text-[64px] font-bold leading-none text-primary">
              84
            </div>
            <p className="text-label-sm uppercase tracking-widest text-secondary">
              Overall Score
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-5">
          <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow">
            <h3 className="mb-6 text-headline-md font-bold">Performance Radar</h3>
            <div className="flex items-center justify-center py-8">
              <svg viewBox="0 0 200 200" className="h-64 w-64">
                {[20, 40, 60, 80, 100].map((r) => (
                  <polygon
                    key={r}
                    points={`100,${100 - r * 0.8} ${100 + r * 0.69},${100 - r * 0.4} ${100 + r * 0.43},${100 + r * 0.65} ${100 - r * 0.43},${100 + r * 0.65} ${100 - r * 0.69},${100 - r * 0.4}`}
                    fill="none"
                    stroke="#e5e5e1"
                    strokeWidth="1"
                  />
                ))}
                <polygon
                  points="100,36 168,68 143,152 57,152 32,68"
                  fill="rgba(0, 80, 203, 0.15)"
                  stroke="#0050cb"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {dimensions.map((d) => (
                <div key={d.label} className="text-center">
                  <div className={`text-headline-md font-bold ${d.color}`}>
                    {d.score}%
                  </div>
                  <div className="text-label-sm text-secondary">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="col-span-12 space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow">
            <h3 className="mb-6 text-headline-md font-bold">AI Analysis</h3>
            <div className="space-y-4">
              {highlights.map((h) => (
                <div
                  key={h.title}
                  className={`rounded-xl border-l-4 p-5 ${
                    h.type === "strength"
                      ? "border-primary bg-primary/5"
                      : "border-tertiary bg-tertiary-fixed/30"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon
                      name={h.type === "strength" ? "thumb_up" : "tips_and_updates"}
                      className={
                        h.type === "strength" ? "text-primary" : "text-tertiary"
                      }
                    />
                    <h4 className="text-label-md font-bold">{h.title}</h4>
                  </div>
                  <p className="text-body-md text-secondary">{h.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-gradient-to-br from-primary to-[#003fa4] p-8 text-white">
            <div className="mb-4 flex items-center gap-3">
              <Icon name="route" />
              <span className="text-label-sm font-bold uppercase tracking-widest">
                Roadmap Impact
              </span>
            </div>
            <h3 className="mb-4 text-headline-md font-bold">
              Your roadmap has been updated
            </h3>
            <p className="mb-6 text-body-md text-white/80">
              Based on this interview, DISHA added{" "}
              <strong className="text-white">System Design Fundamentals</strong>{" "}
              to Week 3 of your roadmap and increased the priority of{" "}
              <strong className="text-white">Docker Basics</strong>.
            </p>
            <div className="flex gap-4">
              <Link
                href="/roadmap"
                className="rounded-xl bg-white px-6 py-3 font-bold text-primary transition-all hover:bg-surface-container-lowest"
              >
                View Updated Roadmap
              </Link>
              <Link
                href="/mock-interview"
                className="rounded-xl border border-white/20 px-6 py-3 font-bold transition-all hover:bg-white/10"
              >
                Practice Again
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
