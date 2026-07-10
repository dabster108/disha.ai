import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export const metadata = {
  title: "Active Interview | DISHA AI",
};

export default function ActiveInterviewPage() {
  return (
    <div className="flex h-[calc(100vh-72px)] w-full overflow-hidden">
      <div className="relative flex flex-1 flex-col bg-surface-container-lowest">
        <div className="grid flex-1 grid-rows-2 items-center gap-6 p-6 lg:grid-cols-2 lg:grid-rows-1">
          <div className="group relative h-full w-full overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
            <Image
              className="h-full w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAlfcsU5b9T8e5mr4lCeVSb1NVBVrLaysDFesG2BnNjGO0Hn0wAMRwQELcNoc00zCP5JhQdngotnOLHvKaEWS-rdJl5LaNjtbJZRtvcKJrBKIHPbmyrIAo77b4tbopfz4L_zCmfuTf718KdSNG3LI7WM0lkJ2h9br8CXFL7BqX9teByk081wL3FNhQg5AdHH9j72E_g8kZpP0sUtfGCKPzbi53PrlPZg-CqTBD-KILqbiRIrQqm33hyww"
              alt="AI Interviewer"
              fill
              sizes="50vw"
            />
            <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-on-surface shadow-sm backdrop-blur-md">
              AI Interviewer (DISHA)
            </div>
          </div>
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
            <div
              className="h-full w-full bg-cover bg-center opacity-80"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAtq_oCwnAK2udQBDJAzSnPPCTNBKjH6o17ZeSPsfazCnJcVB-8m9LjlY1rKr28xF94Q6da-DYfdCFq5mI3gT7a3TD1ID_rm6D3Qw06Juel6eJJwN1IWD9u99A8malQ3x7BXNqkSWY9AvNnjmJFlGkWugK_axxzxZQXkhsd6N8eXOC8Rf0K-8W2nfSsDWcXVdSHgQNBnA0k4d9BGd5JP4LzbXtb6ObBdurPuRMofr0F31_lHs7g7dr35g')",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-end gap-1">
                {[0.1, 0.3, 0.2, 0.4].map((delay, i) => (
                  <div
                    key={i}
                    className="w-1 animate-pulse bg-primary"
                    style={{
                      height: "12px",
                      animationDelay: `${delay}s`,
                      animationDuration: "1.2s",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-on-surface shadow-sm backdrop-blur-md">
              You (Live)
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
            <span className="mb-2 block text-label-sm uppercase tracking-wider text-primary">
              Current Question
            </span>
            <h3 className="text-headline-md leading-tight text-on-surface">
              &quot;How would you optimize a large-scale React application
              experiencing performance bottlenecks in the rendering layer?&quot;
            </h3>
          </div>

          <div className="relative h-24 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
            <div className="space-y-2 opacity-60">
              <p className="text-body-md text-secondary">
                ...mentioning the use of React.memo for component memoization and
                identifying expensive re-renders...
              </p>
              <p className="text-body-md font-medium italic text-on-surface">
                Analyzing your current response: &quot;To address performance,
                I&apos;d first use the Profiler API to...&quot;
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />
          </div>

          <div className="flex items-center justify-center gap-6 py-4">
            <button
              type="button"
              className="group rounded-full border border-outline-variant p-4 transition-all hover:bg-surface-container"
            >
              <Icon
                name="mic"
                className="text-on-surface-variant group-active:scale-90"
              />
            </button>
            <button
              type="button"
              className="group rounded-full border border-outline-variant p-4 transition-all hover:bg-surface-container"
            >
              <Icon
                name="videocam"
                className="text-on-surface-variant group-active:scale-90"
              />
            </button>
            <Link
              href="/mock-interview/report"
              className="flex items-center gap-2 rounded-full bg-error px-8 py-3 text-label-md text-white shadow-lg shadow-error/20 transition-all hover:brightness-110 active:scale-95"
            >
              <Icon name="call_end" className="text-lg" />
              End Session
            </Link>
          </div>
        </div>
      </div>

      <aside className="hidden w-80 flex-col border-l border-outline-variant bg-white p-6 lg:flex">
        <div className="mb-6 flex items-center justify-between">
          <h4 className="text-label-md font-bold text-on-surface">Live Analysis</h4>
          <span className="flex items-center gap-1.5 rounded-full bg-error/10 px-2 py-1 text-[10px] font-bold text-error">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
            RECORDING
          </span>
        </div>
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl font-bold text-primary">12:45</div>
          <p className="text-label-sm uppercase tracking-widest text-secondary">
            Session Duration
          </p>
        </div>
        <div className="space-y-4">
          {[
            { label: "Technical Accuracy", pct: 78, color: "bg-primary" },
            { label: "Communication", pct: 85, color: "bg-primary" },
            { label: "Confidence", pct: 72, color: "bg-tertiary" },
            { label: "Pace & Clarity", pct: 80, color: "bg-primary" },
          ].map((metric) => (
            <div key={metric.label}>
              <div className="mb-1 flex justify-between text-label-sm">
                <span className="text-secondary">{metric.label}</span>
                <span className="font-bold text-on-surface">{metric.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full ${metric.color}`}
                  style={{ width: `${metric.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="auto_awesome" className="text-primary" filled />
            <span className="text-label-sm font-bold text-primary">
              COACH TIP
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            Mention specific metrics like Time to Interactive and Largest
            Contentful Paint when discussing performance optimization.
          </p>
        </div>
      </aside>
    </div>
  );
}
