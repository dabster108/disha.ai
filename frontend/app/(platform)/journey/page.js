"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import { useProfile } from "@/context/ProfileContext";
import { selectJourneyState } from "@/lib/dashboardData";
import SmartCTA from "@/components/dashboard/SmartCTA";

const STATUS_BADGE = {
  complete: { cls: "bg-primary/10 text-primary", label: "Done" },
  in_progress: { cls: "bg-amber-100 text-amber-700", label: "In progress" },
  not_started: { cls: "bg-surface-container text-secondary", label: "Start" },
};

export default function JourneyPage() {
  const { profile, dashboard, dashboardLoading } = useProfile();
  const data = dashboard;
  const loading = dashboardLoading && !dashboard;

  if (loading || !data) return <LoadingState label="Loading your journey..." />;

  const journey = selectJourneyState(data);
  const { steps, completionPct, completedCount, totalSteps, nextAction, readinessScore } = journey;
  const topPriority = data?.gap?.gap_data?.priority_learn?.[0];

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col overflow-hidden">
      <div className="hide-scrollbar flex-1 overflow-y-auto bg-background p-6 md:p-8">
        <section className="mx-auto mb-10 max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="mb-2 text-headline-lg text-on-surface">Your Career Path</h2>
              <p className="text-body-lg text-secondary">{profile?.target_role} Track</p>
            </div>
            <div className="text-right">
              <span className="text-[48px] font-semibold tracking-tighter text-primary">{completionPct}%</span>
              <p className="mt-1 text-label-md uppercase tracking-widest text-outline">Completion</p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8">
          <div className="col-span-12 space-y-4 lg:col-span-8">
            {steps.map((step, i) => {
              const badge = STATUS_BADGE[step.status];
              return (
                <Link
                  key={step.key}
                  href={step.href}
                  className={`flex items-center gap-6 rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                    step.status === "complete" ? "border-outline-variant" : "border-dashed border-outline-variant"
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                      step.status === "complete"
                        ? "bg-primary text-on-primary"
                        : step.status === "in_progress"
                          ? "bg-amber-100 text-amber-700"
                          : "border-2 border-dashed border-outline-variant bg-surface-container-low text-outline"
                    }`}
                  >
                    <Icon name={step.status === "complete" ? "check" : step.icon} />
                  </div>
                  <div className="flex-1">
                    <span className="mb-1 block text-label-sm uppercase tracking-widest text-secondary">
                      Step {i + 1}
                    </span>
                    <h4 className="text-headline-md font-semibold text-on-surface">{step.title}</h4>
                    {step.detail && <p className="mt-0.5 text-sm text-secondary">{step.detail}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${badge.cls}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}

            <div className="mt-4">
              <SmartCTA nextAction={nextAction} />
            </div>
          </div>

          <div className="col-span-12 flex flex-col gap-8 lg:col-span-4">
            {readinessScore != null && (
              <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-headline-md text-on-surface">Readiness</h3>
                  <span className="text-headline-md font-bold text-primary">{readinessScore}%</span>
                </div>
                {topPriority && (
                  <p className="text-body-md text-secondary">
                    Top priority skill:{" "}
                    <span className="font-bold text-on-surface">{topPriority.skill}</span>
                  </p>
                )}
              </div>
            )}

            {data?.gap?.narrative_summary && (
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon name="auto_awesome" className="text-primary" filled />
                  <span className="text-label-md font-bold tracking-wide text-primary">AI MENTOR&apos;S VOICE</span>
                </div>
                <blockquote className="text-body-lg italic leading-relaxed text-on-surface-variant">
                  {data.gap.narrative_summary}
                </blockquote>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-outline-variant bg-white p-5 text-center shadow-sm">
                <span className="block text-headline-md font-bold text-on-surface">
                  {data?.gap?.gap_data?.verified_strong_skills?.length ?? 0}
                </span>
                <span className="text-label-sm uppercase tracking-wider text-outline">Verified Skills</span>
              </div>
              <div className="rounded-xl border border-outline-variant bg-white p-5 text-center shadow-sm">
                <span className="block text-headline-md font-bold text-on-surface">
                  {completedCount}/{totalSteps}
                </span>
                <span className="text-label-sm uppercase tracking-wider text-outline">Steps Done</span>
              </div>
            </div>
          </div>
        </div>
        <div className="h-12" />
      </div>
    </div>
  );
}
