"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useProfile } from "@/context/ProfileContext";
import { createRoadmap, getLatestGap, isNotFound, runSkillGap } from "@/lib/api";

export default function SkillGapPage() {
  const { profile, profileId } = useProfile();
  const router = useRouter();

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLatestGap(profileId);
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

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      // Skip the narrative (its own Groq call) so the buckets, readiness
      // score, and priority list — all deterministic — show up immediately.
      // The AI summary is fetched separately, on demand, below.
      const data = await runSkillGap(profileId, { include_narrative: false });
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

  if (loading) return <LoadingState label="Loading your skill gap..." />;

  if (error) {
    return (
      <div className="p-12">
        <ErrorBanner message={error.message} onRetry={load} />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen p-12">
        <header className="mb-12">
          <h1 className="text-display-lg text-on-surface">Skill Gap Analysis</h1>
          <p className="mt-2 max-w-2xl text-body-lg text-secondary">
            See exactly what {profile?.target_role} jobs in Nepal require, and how your
            skills — verified by interview and practice — measure up.
          </p>
        </header>
        <EmptyState
          icon="insights"
          title="No analysis yet"
          description="Run your first skill gap analysis to see your readiness score, missing skills, and a personalized roadmap."
          actionLabel={running ? "Running..." : "Run Analysis"}
          onAction={running ? undefined : handleRun}
        />
      </div>
    );
  }

  const gap = snapshot.gap_data;

  return (
    <div className="min-h-screen p-12">
      <header className="mb-12 mask-reveal">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              Competency Analysis
            </span>
            <h2 className="text-display-lg text-on-surface">Skill Gap Analysis</h2>
            <p className="mt-2 max-w-2xl text-body-lg text-secondary">
              Your trajectory towards{" "}
              <span className="font-bold text-on-surface">{gap.target_role}</span> roles,
              based on {gap.jobs_analyzed} live Nepal job postings.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-headline-lg text-primary">{gap.readiness_score}%</div>
              <div className="text-label-sm uppercase tracking-widest text-secondary">
                Market Readiness
              </div>
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="rounded-xl border border-outline-variant px-5 py-3 text-label-md font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
            >
              {running ? "Re-running..." : "Re-run Analysis"}
            </button>
          </div>
        </div>
      </header>

      {snapshot.narrative_summary ? (
        <div className="mb-12 rounded-2xl border border-primary/20 bg-primary/5 p-8 mask-reveal">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="auto_awesome" className="text-primary" filled />
            <span className="text-label-md font-bold uppercase tracking-wide text-primary">
              AI Summary
            </span>
          </div>
          <p className="whitespace-pre-line text-body-lg leading-relaxed text-on-surface-variant">
            {snapshot.narrative_summary}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGenerateNarrative}
          disabled={generatingNarrative}
          className="mb-12 flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <Icon name="auto_awesome" className="text-primary" />
          <span className="text-label-md font-bold text-primary">
            {generatingNarrative ? "Writing your AI summary..." : "Generate AI Summary"}
          </span>
        </button>
      )}

      <div className="grid grid-cols-12 items-start gap-8">
        <section className="col-span-12 space-y-6 mask-reveal lg:col-span-4">
          <h3 className="text-headline-md text-on-surface">Your Skills</h3>

          <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <p className="mb-4 text-label-sm font-bold uppercase tracking-wider text-secondary">
              Matched — On CV &amp; In Demand
            </p>
            <div className="flex flex-wrap gap-2">
              {gap.matched_skills.length === 0 && (
                <span className="text-sm text-secondary">None matched yet</span>
              )}
              {gap.matched_skills.map((s) => (
                <span
                  key={s.skill}
                  className="rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary"
                  title={`${s.jobs_requiring} jobs require this`}
                >
                  {s.skill}
                </span>
              ))}
            </div>
          </div>

          <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <p className="mb-4 text-label-sm font-bold uppercase tracking-wider text-secondary">
              Verified Strong
            </p>
            <div className="flex flex-wrap gap-2">
              {gap.verified_strong_skills.length === 0 && (
                <span className="text-sm text-secondary">Complete an interview or practice session to verify skills</span>
              )}
              {gap.verified_strong_skills.map((s) => (
                <span
                  key={`${s.skill}-${s.source}`}
                  className="rounded-full bg-green-100 px-3 py-1.5 text-label-md text-green-700"
                  title={`Verified via ${s.source} (${s.score})`}
                >
                  {s.skill}
                </span>
              ))}
            </div>
          </div>

          {gap.verified_weak_skills.length > 0 && (
            <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
              <p className="mb-4 text-label-sm font-bold uppercase tracking-wider text-secondary">
                Verified Weak
              </p>
              <div className="flex flex-wrap gap-2">
                {gap.verified_weak_skills.map((s) => (
                  <span
                    key={`${s.skill}-${s.source}`}
                    className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed"
                    title={`Verified via ${s.source} (${s.score})`}
                  >
                    {s.skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {gap.overclaimed_skills.length > 0 && (
            <div className="rounded-2xl border border-error/20 bg-error-container/30 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Icon name="warning" className="text-error" />
                <p className="text-label-sm font-bold uppercase tracking-wider text-on-error-container">
                  Overclaimed on CV
                </p>
              </div>
              <div className="space-y-3">
                {gap.overclaimed_skills.map((s) => (
                  <div key={s.skill} className="text-body-md text-on-error-container">
                    <span className="font-bold">{s.skill}</span> — {s.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="relative col-span-12 overflow-hidden rounded-[32px] border border-outline-variant bg-surface-container-low p-8 mask-reveal lg:col-span-4">
          <div className="pointer-events-none absolute right-0 top-0 p-12 opacity-5">
            <Icon name="warning" size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="mb-2 text-headline-md text-on-surface">Priority to Learn</h3>
            <p className="mb-8 text-body-md text-secondary">
              Ranked by market demand and verified gaps.
            </p>
            <div className="space-y-4">
              {gap.priority_learn.length === 0 && (
                <p className="text-sm text-secondary">No priority gaps found — great work!</p>
              )}
              {gap.priority_learn.slice(0, 6).map((p) => (
                <div
                  key={p.skill}
                  className="rounded-2xl border-l-4 border-primary bg-surface-container-lowest p-5 shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="text-label-md font-bold text-on-surface">{p.skill}</h4>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                      {p.priority_score}
                    </span>
                  </div>
                  <p className="text-body-md text-secondary">{p.reason}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleGenerateRoadmap}
              disabled={generatingRoadmap}
              className="mt-10 block w-full rounded-xl bg-primary py-4 text-center text-label-md font-bold text-white transition-all hover:shadow-lg active:scale-95 disabled:opacity-60"
            >
              {generatingRoadmap ? "Generating..." : "Generate Roadmap"}
            </button>
          </div>
        </section>

        <section className="col-span-12 space-y-6 mask-reveal lg:col-span-4">
          {gap.interview_insights && (
            <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-headline-md text-on-surface">Interview Insights</h3>
                <span className="text-headline-md font-bold text-primary">
                  {gap.interview_insights.overall_score}/10
                </span>
              </div>
              <div className="space-y-2">
                {(gap.interview_insights.strengths || []).slice(0, 2).map((s) => (
                  <p key={s} className="flex gap-2 text-body-md text-secondary">
                    <Icon name="thumb_up" size={16} className="mt-0.5 shrink-0 text-primary" />
                    {s}
                  </p>
                ))}
                {(gap.interview_insights.weaknesses || []).slice(0, 2).map((w) => (
                  <p key={w} className="flex gap-2 text-body-md text-secondary">
                    <Icon name="tips_and_updates" size={16} className="mt-0.5 shrink-0 text-tertiary" />
                    {w}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="ambient-shadow rounded-2xl border border-outline-variant bg-surface-container-lowest p-8">
            <p className="mb-6 text-label-sm uppercase tracking-widest text-secondary">
              Market Context
            </p>
            {gap.sample_jobs.length === 0 ? (
              <p className="text-sm text-secondary">No matching jobs found yet.</p>
            ) : (
              <div className="space-y-4">
                {gap.sample_jobs.map((job, i) => (
                  <a
                    key={`${job.title}-${job.company}-${i}`}
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-xl border border-outline-variant/50 bg-white p-4 transition-colors hover:border-primary"
                  >
                    <div>
                      <p className="text-label-md font-bold text-on-surface group-hover:text-primary">
                        {job.title}
                      </p>
                      <p className="text-sm text-secondary">{job.company}</p>
                    </div>
                    <Icon name="open_in_new" size={16} className="text-secondary" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
