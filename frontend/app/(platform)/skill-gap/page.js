"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useProfile } from "@/context/ProfileContext";
import { createRoadmap, getLatestGap, isNotFound, runSkillGap } from "@/lib/api";

const CONFIDENCE_STYLE = {
  high: { cls: "bg-green-100 text-green-700", label: "High" },
  medium: { cls: "bg-primary/10 text-primary", label: "Medium" },
  low: { cls: "bg-tertiary-fixed text-on-tertiary-fixed", label: "Low" },
};

function ConfidenceBadge({ level }) {
  const style = CONFIDENCE_STYLE[level] || CONFIDENCE_STYLE.low;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.cls}`}>
      {style.label}
    </span>
  );
}

function ValidationPanel({ evidence, onRun, running }) {
  if (!evidence) return null;
  const { signals = {}, accuracy_level, confidence_legend = {}, checklist = [] } = evidence;
  const accuracyStyle =
    accuracy_level === "High"
      ? "bg-green-100 text-green-700"
      : accuracy_level === "Medium"
        ? "bg-primary/10 text-primary"
        : "bg-tertiary-fixed text-on-tertiary-fixed";

  const signalCards = [
    {
      key: "cv_claimed",
      icon: "description",
      title: "CV / Claimed Skills",
      detail: signals.cv_claimed?.present
        ? `${signals.cv_claimed.count} skills on your profile`
        : "No skills on profile yet",
      ok: signals.cv_claimed?.present,
    },
    {
      key: "market",
      icon: "work",
      title: "Live Nepal Job Market",
      detail: `${signals.market?.jobs_analyzed ?? 0} postings analyzed • ${signals.market?.skills_in_demand ?? 0} skills in demand`,
      ok: signals.market?.present,
    },
    {
      key: "interview",
      icon: "record_voice_over",
      title: "Mock Interview Proof",
      detail: signals.interview?.present
        ? `Score ${signals.interview.overall_score ?? "—"}/10 • ${signals.interview.verified_skills} skills tested`
        : "Not completed — reduces accuracy",
      ok: signals.interview?.present,
    },
    {
      key: "practice",
      icon: "sports_esports",
      title: "Skill Practice Proof",
      detail: signals.practice?.present
        ? `${signals.practice.verified_skills} skills verified`
        : "Not completed — reduces accuracy",
      ok: signals.practice?.present,
    },
  ];

  return (
    <div className="mb-12 rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 mask-reveal">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Icon name="verified" className="text-primary" filled />
          <div>
            <h3 className="text-headline-md text-on-surface">How we know this is true</h3>
            <p className="text-body-md text-secondary">
              Every skill verdict is backed by up to 4 evidence signals.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-label-md font-bold ${accuracyStyle}`}>
          {accuracy_level} accuracy
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {signalCards.map((s) => (
          <div
            key={s.key}
            className={`rounded-xl border p-4 ${s.ok ? "border-green-200 bg-green-50/40" : "border-outline-variant bg-white"}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <Icon name={s.icon} className={s.ok ? "text-green-600" : "text-secondary"} />
              <Icon
                name={s.ok ? "check_circle" : "radio_button_unchecked"}
                size={18}
                className={s.ok ? "text-green-600" : "text-outline"}
              />
            </div>
            <p className="text-label-md font-bold text-on-surface">{s.title}</p>
            <p className="mt-1 text-sm text-secondary">{s.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-secondary">
        {Object.entries(confidence_legend).map(([level, desc]) => (
          <span key={level} className="flex items-center gap-2">
            <ConfidenceBadge level={level} />
            {desc}
          </span>
        ))}
      </div>

      {checklist.some((c) => !c.done) && (
        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="mb-3 flex items-center gap-2 text-label-md font-bold text-primary">
            <Icon name="checklist" size={18} />
            Validate my gap — raise your accuracy
          </p>
          <div className="space-y-2">
            {checklist.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-body-md text-on-surface">
                  <Icon
                    name={c.done ? "check_circle" : "radio_button_unchecked"}
                    size={18}
                    className={c.done ? "text-green-600" : "text-secondary"}
                  />
                  <span className={c.done ? "text-secondary line-through" : ""}>{c.label}</span>
                  <span className="hidden text-xs text-secondary sm:inline">— {c.impact}</span>
                </span>
                {!c.done && (
                  <Link href={c.href} className="shrink-0 text-label-md font-bold text-primary hover:underline">
                    Start
                  </Link>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="mt-4 text-label-md font-bold text-primary hover:underline disabled:opacity-60"
          >
            {running ? "Re-running..." : "Re-run analysis after completing these"}
          </button>
        </div>
      )}
    </div>
  );
}

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

      <ValidationPanel evidence={gap.evidence} onRun={handleRun} running={running} />

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
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary"
                  title={`${s.jobs_requiring} jobs require this${s.verified ? " • verified in testing" : ""}`}
                >
                  {s.skill}
                  {s.confidence && <ConfidenceBadge level={s.confidence} />}
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
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-label-md font-bold text-on-surface">
                      {p.skill}
                      {p.confidence && <ConfidenceBadge level={p.confidence} />}
                    </h4>
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
            <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">
              Market Evidence
            </p>
            <p className="mb-6 text-sm text-secondary">
              Real postings backing this analysis.
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
                    className="group block rounded-xl border border-outline-variant/50 bg-white p-4 transition-colors hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-label-md font-bold text-on-surface group-hover:text-primary">
                          {job.title}
                        </p>
                        <p className="text-sm text-secondary">{job.company}</p>
                      </div>
                      {job.match_score != null && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                          {job.match_score}%
                        </span>
                      )}
                    </div>
                    {job.matched_skills?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.matched_skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
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
