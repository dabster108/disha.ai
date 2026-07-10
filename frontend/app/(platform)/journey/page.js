import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

const resources = [
  "React Design Patterns",
  "State Management Deep Dive",
];

const benchmarks = [
  {
    icon: "history_edu",
    title: "Framework Certification",
    date: "Expected: Oct 12, 2024",
  },
  {
    icon: "forum",
    title: "Mock Interview Series",
    date: "Expected: Oct 25, 2024",
  },
];

export default function JourneyPage() {
  return (
    <div className="flex h-[calc(100vh-72px)] flex-col overflow-hidden">
      <div className="hide-scrollbar flex-1 overflow-y-auto bg-background p-8">
        <section className="mx-auto mb-10 max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="mb-2 text-headline-lg text-on-surface">
                Your Career Path
              </h2>
              <p className="text-body-lg text-secondary">
                Senior Frontend Developer Track
              </p>
            </div>
            <div className="text-right">
              <span className="text-[48px] font-semibold tracking-tighter text-primary">
                68%
              </span>
              <p className="mt-1 text-label-md uppercase tracking-widest text-outline">
                Completion
              </p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full w-[68%] rounded-full bg-primary transition-all duration-1000" />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl grid-cols-12 items-start gap-8">
          <div className="relative col-span-12 min-h-[600px] overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm lg:col-span-8">
            <div className="roadmap-grid pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative flex flex-col items-center p-12">
              {["Fundamentals", "CSS Mastery"].map((node) => (
                <div key={node} className="flex flex-col items-center">
                  <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
                    <Icon name="check" />
                  </div>
                  <span className="mt-4 text-label-md font-semibold text-on-surface">
                    {node}
                  </span>
                  <div className="node-connector h-16 w-[2px] opacity-40" />
                </div>
              ))}

              <div className="relative flex flex-col items-center">
                <div className="absolute -inset-2 animate-ping rounded-full bg-primary/10 opacity-20" />
                <div className="pulse-border z-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary bg-white text-primary shadow-xl">
                  <Icon name="rocket_launch" size={32} />
                </div>
                <span className="mt-4 text-headline-md font-bold text-primary">
                  Advanced React
                </span>
                <div className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">
                  Current Focus
                </div>
              </div>

              <div className="node-connector h-16 w-[2px] opacity-40" />

              <div className="relative flex gap-24">
                <div className="flex flex-col items-center">
                  <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-outline-variant bg-surface-container-low text-outline">
                    <Icon name="auto_awesome" />
                  </div>
                  <span className="mt-4 text-label-md text-outline">
                    System Design
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="z-10 flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-low text-outline-variant grayscale">
                    <Icon name="lock" />
                  </div>
                  <span className="mt-4 text-label-md text-outline-variant">
                    Cloud Architecture
                  </span>
                </div>
              </div>

              <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                {["add", "remove", "center_focus_weak", "fullscreen"].map(
                  (icon) => (
                    <button
                      key={icon}
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-white shadow-sm transition-colors hover:bg-surface-container-low"
                    >
                      <Icon name={icon} />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 flex flex-col gap-8 lg:col-span-4">
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-headline-md text-on-surface">
                  Advanced React
                </h3>
                <Icon name="more_horiz" className="text-outline" />
              </div>
              <div className="mb-8 space-y-4">
                {[
                  { icon: "schedule", text: "12 hours estimated" },
                  { icon: "play_circle", text: "14 Video Lessons" },
                  { icon: "terminal", text: "2 Real-world Projects" },
                ].map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 text-secondary"
                  >
                    <Icon name={item.icon} size={20} />
                    <span className="text-body-md">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="mb-8">
                <h4 className="mb-4 text-label-md uppercase tracking-wider text-outline">
                  Resources
                </h4>
                <div className="space-y-2">
                  {resources.map((r) => (
                    <Link
                      key={r}
                      href="/learning"
                      className="group flex items-center justify-between rounded-lg bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
                    >
                      <span className="text-body-md">{r}</span>
                      <Icon
                        name="arrow_forward"
                        size={16}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </Link>
                  ))}
                </div>
              </div>
              <Link
                href="/learning"
                className="block w-full rounded-xl bg-primary py-4 text-center text-headline-md font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98]"
              >
                Resume Learning
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-6">
              <div className="absolute -right-4 -top-4 text-primary/10">
                <Icon name="format_quote" size={120} filled />
              </div>
              <div className="mb-4 flex items-center gap-2">
                <Icon name="auto_awesome" className="text-primary" filled />
                <span className="text-label-md font-bold tracking-wide text-primary">
                  AI MENTOR&apos;S VOICE
                </span>
              </div>
              <blockquote className="relative z-10 text-body-lg italic leading-relaxed text-on-surface-variant">
                &quot;You&apos;re making great progress in React. To fast-track your
                path to Senior Developer, consider starting{" "}
                <span className="font-bold text-primary not-italic">
                  System Design
                </span>{" "}
                early. It&apos;s the critical gap in your current profile for
                top-tier roles.&quot;
              </blockquote>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "24", label: "Skills Earned" },
                { value: "142", label: "Hours Invested" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-outline-variant bg-white p-5 text-center shadow-sm"
                >
                  <span className="block text-headline-md font-bold text-on-surface">
                    {stat.value}
                  </span>
                  <span className="text-label-sm uppercase tracking-wider text-outline">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <h4 className="mb-6 text-label-md font-bold uppercase tracking-wider text-on-surface">
                Upcoming Benchmarks
              </h4>
              <div className="space-y-6">
                {benchmarks.map((b) => (
                  <div key={b.title} className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                      <Icon name={b.icon} className="text-outline" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-body-md">{b.title}</p>
                      <p className="text-label-sm text-outline">{b.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="h-12" />
      </div>
    </div>
  );
}
