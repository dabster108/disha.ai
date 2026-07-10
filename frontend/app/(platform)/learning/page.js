import Link from "next/link";
import Icon from "@/components/ui/Icon";

const resources = [
  {
    type: "Course",
    title: "Advanced React Patterns",
    provider: "DISHA Learning",
    duration: "8 hours",
    progress: 65,
    icon: "play_circle",
  },
  {
    type: "Video",
    title: "Docker for Frontend Developers",
    provider: "Tech Nepal",
    duration: "2.5 hours",
    progress: 0,
    icon: "video_library",
  },
  {
    type: "Article",
    title: "System Design for Frontend Engineers",
    provider: "Engineering Blog",
    duration: "15 min read",
    progress: 100,
    icon: "article",
  },
  {
    type: "Project",
    title: "Build a Real-time Collaboration Hub",
    provider: "DISHA Projects",
    duration: "12 hours",
    progress: 30,
    icon: "terminal",
  },
];

export default function LearningPage() {
  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Learning Hub</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Recommended courses, videos, articles, and projects tailored to your
          skill gaps and career goals.
        </p>
      </header>

      <div className="mb-8 flex gap-2 rounded-lg bg-surface-container-low p-1 w-fit">
        {["All", "Courses", "Videos", "Articles", "Projects"].map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`rounded-md px-4 py-2 text-label-md ${
              i === 0
                ? "bg-white font-bold text-primary shadow-sm"
                : "text-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {resources.map((r) => (
          <div
            key={r.title}
            className="card-hover rounded-2xl border border-outline-variant bg-white p-6 transition-all"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <Icon name={r.icon} />
                </div>
                <div>
                  <span className="text-label-sm uppercase tracking-wider text-secondary">
                    {r.type}
                  </span>
                  <h3 className="text-headline-md font-bold">{r.title}</h3>
                  <p className="text-label-md text-secondary">{r.provider}</p>
                </div>
              </div>
              <span className="text-label-md text-secondary">{r.duration}</span>
            </div>
            <div className="mb-4 h-1.5 w-full rounded-full bg-surface-container-low">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${r.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-label-sm text-secondary">
                {r.progress === 100
                  ? "Completed"
                  : r.progress > 0
                    ? `${r.progress}% complete`
                    : "Not started"}
              </span>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-label-md text-white hover:bg-primary-container"
              >
                {r.progress > 0 && r.progress < 100 ? "Continue" : "Start"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
