"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import {
  selectJourneyState,
  selectReadinessTrend,
  selectReadinessDelta,
  selectPrioritySkills,
  selectStrongSkills,
  selectMissingSkills,
  selectValidationConfidence,
  selectRoadmapState,
  selectJobMatches,
  selectInterviewAverage,
  selectPracticeAverage,
  selectInterviewTrend,
  selectPracticeTrend,
  selectInterviewDelta,
  selectPracticeDelta,
  selectMatchRatioTrend,
  selectSkillBreakdown,
  selectActivityFeed,
  selectAnalyticsSummary,
} from "@/lib/dashboardData";
import SmartCTA from "@/components/dashboard/SmartCTA";
import StatCard from "@/components/dashboard/StatCard";
import SkillGapSnapshot from "@/components/dashboard/SkillGapSnapshot";
import RoadmapWeekCard from "@/components/dashboard/RoadmapWeekCard";
import JobMatchCard from "@/components/dashboard/JobMatchCard";
import QuickLinksRow from "@/components/dashboard/QuickLinksRow";
import AnalyticsSection from "@/components/dashboard/AnalyticsSection";
import JourneyRing from "@/components/dashboard/JourneyRing";
import ScoreRankSection from "@/components/dashboard/ScoreRankSection";
import { saveJob, loadTrackedJobs, subscribeTrackedJobs } from "@/lib/applicationsStore";
import { getLeaderboard } from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache } from "@/lib/resource-cache";

export default function DashboardPage() {
  const { profile, profileId, dashboard, dashboardLoading, refreshDashboard } = useProfile();
  const [error, setError] = useState(null);
  const [tracked, setTracked] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState(null);

  const data = dashboard;
  const loading = dashboardLoading && !dashboard;

  const refreshTracked = useCallback(() => {
    const items = loadTrackedJobs();
    setTracked(items);
    setSavedIds(new Set(items.map((j) => j.id)));
  }, []);

  useEffect(() => {
    refreshTracked();
    return subscribeTrackedJobs(refreshTracked);
  }, [refreshTracked]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    const cacheKey = `leaderboard:${profileId}`;
    const cached = readCache(cacheKey);
    if (cached.data) setLeaderboard(cached.data);
    loadWithCache(cacheKey, () => getLeaderboard(profileId), CACHE_TTL.leaderboard)
      .then((res) => {
        if (!cancelled) setLeaderboard(res);
      })
      .catch(() => {
        if (!cancelled && !cached.data) setLeaderboard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const yourEntry = leaderboard?.entries?.find((e) => e.profile_id === profileId);

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl p-12">
        <ErrorBanner message={error.message} onRetry={refreshDashboard} />
      </div>
    );
  }

  const journey = selectJourneyState(data);
  const gapData = data?.gap?.gap_data;
  const readinessTrend = selectReadinessTrend(data);
  const readinessDelta = selectReadinessDelta(data);
  const roadmapState = selectRoadmapState(data);
  const jobs = selectJobMatches(data);
  const interviewAvg = selectInterviewAverage(data);
  const practiceAvg = selectPracticeAverage(data);
  const analyticsSummary = selectAnalyticsSummary(data);

  const handleSaveJob = (job) => {
    saveJob(job);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-6 md:p-12">
      {/* Hero + journey ring + smart CTA */}
      <section className="mask-reveal">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="mb-2 text-headline-md text-secondary">
              Hi, {profile?.full_name || "there"} 👋
            </p>
            <h2 className="max-w-3xl text-display-lg">
              {gapData ? (
                <>
                  You&apos;re <span className="text-primary">{gapData.readiness_score}% ready</span> for
                  your {profile?.target_role} role.
                </>
              ) : (
                <>Let&apos;s find your skill gap for {profile?.target_role}.</>
              )}
            </h2>
            <p className="mt-2 text-body-md text-secondary">
              {data?.gap_stale
                ? "Last skill gap is stale — refresh for fresh insights."
                : "Your career command center — track progress, gaps, and next steps."}
            </p>
          </div>
          <div className="lg:col-span-3">
            <JourneyRing
              pct={journey?.completionPct ?? 0}
              completedCount={journey?.completedCount ?? 0}
              totalSteps={journey?.totalSteps ?? 6}
              readinessScore={gapData?.readiness_score}
            />
          </div>
          <div className="lg:col-span-4">
            <SmartCTA nextAction={journey?.nextAction || data?.next_action} />
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        <StatCard
          icon="analytics"
          label="Readiness"
          value={gapData ? `${gapData.readiness_score}%` : "—"}
          progress={gapData?.readiness_score}
          trend={readinessDelta}
          tone="primary"
        />
        <StatCard
          icon="timeline"
          label="Roadmap"
          value={data?.roadmap ? `${roadmapState.pct}%` : "Not started"}
          sub={
            data?.roadmap
              ? roadmapState.isPathBased
                ? `${roadmapState.completedTasks}/${roadmapState.totalTasks} skills`
                : `${roadmapState.completedTasks}/${roadmapState.totalTasks} tasks · ${data.roadmap.total_weeks} weeks`
              : "Run skill gap to generate"
          }
          progress={data?.roadmap ? roadmapState.pct : undefined}
          tone="tertiary"
        />
        <StatCard
          icon="record_voice_over"
          label="Interviews"
          value={analyticsSummary.interviewCount > 0 ? `${interviewAvg?.toFixed(1) ?? "—"}/10` : "—"}
          sub={
            analyticsSummary.interviewCount > 0
              ? `${analyticsSummary.interviewCount} completed · best ${analyticsSummary.interviewBest}/10`
              : "Take a mock interview"
          }
          tone="secondary"
        />
        <StatCard
          icon="work"
          label="Job Matches"
          value={data ? `${data.job_matches.length} jobs` : "—"}
          sub={data?.jobs_ok ? "Live recommendations" : "From cached gap report"}
          tone="accent"
        />
      </section>

      {/* Full analytics */}
      <AnalyticsSection
        readinessTrend={readinessTrend}
        readinessDelta={readinessDelta}
        interviewTrend={selectInterviewTrend(data)}
        interviewDelta={selectInterviewDelta(data)}
        practiceTrend={selectPracticeTrend(data)}
        practiceDelta={selectPracticeDelta(data)}
        matchRatioTrend={selectMatchRatioTrend(data)}
        skillBreakdown={selectSkillBreakdown(data)}
        hasGap={Boolean(gapData)}
        activityFeed={selectActivityFeed(data)}
        summary={analyticsSummary}
        interviewAvg={interviewAvg}
        practiceAvg={practiceAvg}
      />

      <ScoreRankSection
        yourRank={leaderboard?.your_rank}
        totalEntries={leaderboard?.entries?.length}
        categoryScores={yourEntry?.category_scores}
      />

      {/* Roadmap + skill gap snapshot */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="mb-3 text-headline-sm font-bold text-on-surface">Current Week</h3>
          <RoadmapWeekCard roadmap={data?.roadmap} progress={roadmapState} />
        </div>
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-headline-sm font-bold text-on-surface">Skill Gap</h3>
          <SkillGapSnapshot
            strongSkills={selectStrongSkills(data)}
            prioritySkills={selectPrioritySkills(data)}
            missingSkills={selectMissingSkills(data)}
            confidence={selectValidationConfidence(data)}
            hasGap={Boolean(gapData)}
          />
        </div>
      </section>

      {/* Job matches */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-headline-sm font-bold text-on-surface">Job Matches For You</h3>
            <p className="text-body-md text-secondary">
              {data?.jobs_ok
                ? "Real recommendations from the job-matching engine."
                : "Cached from your last skill gap — job matching temporarily unavailable."}
            </p>
          </div>
          <Link href="/jobs" className="text-label-md font-bold text-primary hover:underline">
            View all
          </Link>
        </div>
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-body-md text-secondary">
            No matching jobs found for your current skill set yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {jobs.map((job) => {
              const id = job.id || `${job.title}|${job.company}`;
              return (
                <JobMatchCard
                  key={id}
                  job={job}
                  onSave={handleSaveJob}
                  saved={savedIds.has(id)}
                />
              );
            })}
          </div>
        )}
        {tracked.length > 0 && (
          <p className="text-sm text-secondary">
            You&apos;re tracking <span className="font-bold text-on-surface">{tracked.length}</span>{" "}
            job{tracked.length !== 1 ? "s" : ""} in Applications.
          </p>
        )}
      </section>

      {/* Quick navigation */}
      <section className="space-y-4">
        <h3 className="text-headline-sm font-bold text-on-surface">Quick Navigation</h3>
        <QuickLinksRow steps={journey?.steps || []} />
      </section>
    </div>
  );
}
