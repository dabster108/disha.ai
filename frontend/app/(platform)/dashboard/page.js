"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory, getLatestGap, getLatestRoadmap, getPracticeHistory } from "@/lib/api";

function currentWeekLabel(roadmap) {
  if (!roadmap) return null;
  const completedWeeks = new Set();
  for (const week of roadmap.weeks) {
    const doneCount = week.tasks.filter((_, i) =>
      (roadmap.progress?.completed || []).some((e) => e.week === week.week && e.task_index === i)
    ).length;
    if (doneCount === week.tasks.length && week.tasks.length > 0) completedWeeks.add(week.week);
  }
  const current = completedWeeks.size + 1;
  return current > roadmap.total_weeks ? "Complete" : `Week ${current}`;
}

export default function DashboardPage() {
  const { profile, profileId } = useProfile();

  const [gap, setGap] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      const [gapResult, roadmapResult, interviewResult, practiceResult] = await Promise.allSettled([
        getLatestGap(profileId),
        getLatestRoadmap(profileId),
        getInterviewHistory(profileId),
        getPracticeHistory(profileId),
      ]);
      if (cancelled) return;

      setGap(gapResult.status === "fulfilled" ? gapResult.value : null);
      setRoadmap(roadmapResult.status === "fulfilled" ? roadmapResult.value : null);
      setInterviews(interviewResult.status === "fulfilled" ? interviewResult.value : []);
      setPractices(practiceResult.status === "fulfilled" ? practiceResult.value : []);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  const gapData = gap?.gap_data;
  const hasCompletedInterview = interviews.some((s) => s.status === "completed");
  const hasCompletedPractice = practices.some((s) => s.status === "completed");

  let continueHref = "/skill-gap";
  let continueLabel = "Run Skill Gap Analysis";
  if (gapData) {
    if (!hasCompletedInterview) {
      continueHref = "/mock-interview";
      continueLabel = "Take a Mock Interview";
    } else {
      continueHref = "/roadmap";
      continueLabel = "View Your Roadmap";
    }
  }

  const stats = [
    {
      icon: "analytics",
      label: "Readiness",
      value: gapData ? `${gapData.readiness_score}%` : "—",
      color: "text-primary",
      bg: "bg-primary/5",
      progress: gapData?.readiness_score,
    },
    {
      icon: "timeline",
      label: "Roadmap",
      value: roadmap ? currentWeekLabel(roadmap) : "Not started",
      color: "text-tertiary",
      bg: "bg-tertiary/5",
      sub: roadmap ? `of ${roadmap.total_weeks} weeks` : "Run skill gap to generate",
    },
    {
      icon: "psychology",
      label: "Priority Skills",
      value: gapData ? `${gapData.priority_learn.length} Skills` : "—",
      color: "text-secondary",
      bg: "bg-secondary/5",
      sub: "Ranked by market demand",
    },
    {
      icon: "work",
      label: "Job Matches",
      value: gapData ? `${gapData.sample_jobs.length} Jobs` : "—",
      color: "text-on-secondary-fixed-variant",
      bg: "bg-secondary-fixed",
      sub: "From your skill gap report",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-12">
      <section className="mask-reveal">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-headline-md text-secondary">
              Hi, {profile?.full_name || "there"} 👋
            </p>
            <h2 className="max-w-3xl text-display-lg">
              {gapData ? (
                <>
                  You&apos;re <span className="text-primary">{gapData.readiness_score}% ready</span>{" "}
                  for your {profile?.target_role} role.
                </>
              ) : (
                <>Let&apos;s find your skill gap for {profile?.target_role}.</>
              )}
            </h2>
          </div>
          <Link
            href={continueHref}
            className="flex h-fit items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-95"
          >
            {continueLabel}
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
              <span className={`rounded-lg p-2 ${stat.bg} ${stat.color}`}>
                <Icon name={stat.icon} />
              </span>
              <span className="text-label-sm uppercase tracking-wider text-secondary">
                {stat.label}
              </span>
            </div>
            <div className="text-headline-lg font-bold">{stat.value}</div>
            {stat.progress != null ? (
              <div className="mt-4 h-1.5 w-full rounded-full bg-surface-container-low">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${stat.progress}%` }}
                />
              </div>
            ) : (
              <div className="mt-4 text-label-md text-secondary">{stat.sub}</div>
            )}
          </div>
        ))}
      </div>

      {gapData && (
        <section className="space-y-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h3 className="mb-2 text-headline-md">Job Matches For You</h3>
              <p className="text-body-md text-secondary">
                From your latest skill gap analysis against live Nepal job postings.
              </p>
            </div>
            <Link href="/jobs" className="text-label-md font-bold text-primary hover:underline">
              View all
            </Link>
          </div>

          {gapData.sample_jobs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-body-md text-secondary">
              No matching jobs found for your current skill set yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {gapData.sample_jobs.map((job, i) => (
                <a
                  key={`${job.title}-${job.company}-${i}`}
                  href={job.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-hover flex items-center justify-between rounded-2xl border border-outline-variant bg-white p-6 transition-all"
                >
                  <div>
                    <h4 className="text-headline-md font-bold">{job.title}</h4>
                    <p className="text-body-md text-secondary">{job.company}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-4 py-1.5 text-label-md font-bold text-primary">
                    {job.match_score ?? Math.round(job.similarity * 100)}% match
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="record_voice_over" className="text-primary" />
            <h4 className="text-label-md font-bold">Interviews</h4>
          </div>
          <p className="mb-4 text-body-md text-secondary">
            {hasCompletedInterview
              ? `${interviews.filter((s) => s.status === "completed").length} completed`
              : "No completed interviews yet"}
          </p>
          <Link href="/mock-interview" className="text-label-md font-bold text-primary hover:underline">
            {hasCompletedInterview ? "Practice again" : "Start an interview"}
          </Link>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="sports_esports" className="text-primary" />
            <h4 className="text-label-md font-bold">Practice</h4>
          </div>
          <p className="mb-4 text-body-md text-secondary">
            {hasCompletedPractice
              ? `${practices.filter((s) => s.status === "completed").length} sessions completed`
              : "No practice sessions yet"}
          </p>
          <Link href="/practice" className="text-label-md font-bold text-primary hover:underline">
            {hasCompletedPractice ? "Practice more skills" : "Start practicing"}
          </Link>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="route" className="text-primary" />
            <h4 className="text-label-md font-bold">Roadmap</h4>
          </div>
          <p className="mb-4 text-body-md text-secondary">
            {roadmap ? `${roadmap.total_weeks}-week plan active` : "No roadmap generated yet"}
          </p>
          <Link href="/roadmap" className="text-label-md font-bold text-primary hover:underline">
            {roadmap ? "Continue roadmap" : "Generate a roadmap"}
          </Link>
        </div>
      </div>
    </div>
  );
}
