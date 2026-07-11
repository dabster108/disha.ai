"use client";

/**
 * IA (see prompt for full rationale):
 *   Hero (readiness + accuracy + one primary CTA)
 *   -> Learn next (priority_learn, ranked)
 *   -> Your standing (matched / verified strong / weak / overclaimed)
 *   -> Interview insights (compact, only if present)
 *   -> Evidence (collapsed accordion — was the always-open ValidationPanel)
 *   -> Role fit (short callout, only when there's something to explain)
 *   -> Coach note (narrative, generate-on-demand)
 *   -> Jobs this is based on (external market proof)
 *
 * No backend changes: same gap_data fields, same API calls, same cache keys.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { createRoadmap, getLatestGap, isNotFound, runSkillGap } from "@/lib/api";
import { CACHE_TTL, loadWithCache, readCache, invalidateCache } from "@/lib/resource-cache";
import SkillGapSkeleton from "@/components/skill-gap/SkillGapSkeleton";
import SkillGapHero from "@/components/skill-gap/SkillGapHero";
import PriorityLearnList from "@/components/skill-gap/PriorityLearnList";
import SkillsStanding from "@/components/skill-gap/SkillsStanding";
import EvidencePanel from "@/components/skill-gap/EvidencePanel";
import RoleFitPanel from "@/components/skill-gap/RoleFitPanel";
import CoachNote from "@/components/skill-gap/CoachNote";
import MarketJobsList from "@/components/skill-gap/MarketJobsList";

/** Compact — under Standing, not a third equal-weight column. */
function InterviewInsightsCompact({ insights }) {
  if (!insights) return null;
  return (
    <section className="mb-16 mask-reveal">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-md text-on-surface">Interview insights</h2>
        <span className="text-headline-sm font-bold text-primary">{insights.overall_score}/10</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {(insights.strengths || []).slice(0, 2).map((s) => (
          <p key={s} className="flex gap-2 text-body-md text-secondary">
            <Icon name="thumb_up" size={16} className="mt-0.5 shrink-0 text-primary" />
            {s}
          </p>
        ))}
        {(insights.weaknesses || []).slice(0, 2).map((w) => (
          <p key={w} className="flex gap-2 text-body-md text-secondary">
            <Icon name="tips_and_updates" size={16} className="mt-0.5 shrink-0 text-tertiary" />
            {w}
          </p>
        ))}
      </div>
    </section>
  );
}

export default function SkillGapPage() {
  const { profile, profileId } = useProfile();
  const router = useRouter();
  const cacheKey = `gap:${profileId}`;

  const initial = readCache(cacheKey);
  const [snapshot, setSnapshot] = useState(initial.data);
  const [loading, setLoading] = useState(!initial.data);
  const [running, setRunning] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!profileId) return;
    if (!snapshot) setLoading(true);
    setError(null);
    try {
      const data = await loadWithCache(cacheKey, () => getLatestGap(profileId), CACHE_TTL.gap);
      setSnapshot(data);
    } catch (err) {
      if (isNotFound(err)) {
        setSnapshot(null);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Re-running keeps the current snapshot on screen (no full-page blank) —
  // only the hero's buttons reflect the in-flight request.
  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await runSkillGap(profileId, { include_narrative: false });
      invalidateCache(`gap:${profileId}`);
      setSnapshot(data);
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  const handleGenerateNarrative = async () => {
    setGeneratingNarrative(true);
    setError(null);
    try {
      const data = await runSkillGap(profileId, {
        include_narrative: true,
        interview_session_id: snapshot.interview_session_id,
        practice_session_id: snapshot.practice_session_id,
      });
      invalidateCache(`gap:${profileId}`);
      setSnapshot(data);
    } catch (err) {
      setError(err);
    } finally {
      setGeneratingNarrative(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    setGeneratingRoadmap(true);
    setError(null);
    try {
      await createRoadmap(profileId, { snapshot_id: snapshot.id });
      router.push("/roadmap");
    } catch (err) {
      setError(err);
      setGeneratingRoadmap(false);
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="mx-auto max-w-4xl p-6 md:p-12">
        <SkillGapSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-2xl p-6 py-16 md:p-12 md:py-24">
        <header className="mb-10 text-center">
          <h1 className="text-display-lg text-on-surface">
            How ready are you for {profile?.target_role || "your target role"}?
          </h1>
          <p className="mt-4 text-body-lg text-secondary">
            See how your skills measure up against real Nepal job postings — verified by interview
            and practice, not guesswork.
          </p>
        </header>
        <EmptyState
          icon="insights"
          title="No analysis yet"
          description="Run your first skill gap analysis to see your readiness score and what to learn next."
          actionLabel={running ? "Reading Nepal job postings..." : "Run Analysis"}
          onAction={running ? undefined : handleRun}
        />
      </div>
    );
  }

  const gap = snapshot.gap_data;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-12">
      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      <SkillGapHero
        gap={gap}
        onGenerateRoadmap={handleGenerateRoadmap}
        generatingRoadmap={generatingRoadmap}
        onRun={handleRun}
        running={running}
      />

      <PriorityLearnList gap={gap} />

      <SkillsStanding gap={gap} />

      <InterviewInsightsCompact insights={gap.interview_insights} />

      <EvidencePanel evidence={gap.evidence} />

      <RoleFitPanel roleFit={gap.role_fit} />

      <CoachNote
        narrative={snapshot.narrative_summary}
        onGenerate={handleGenerateNarrative}
        generating={generatingNarrative}
      />

      <MarketJobsList jobs={gap.sample_jobs} />
    </div>
  );
}
