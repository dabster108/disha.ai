"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { getSyntheticEval, getSyntheticRecommendations } from "@/lib/api";

// Fixed vocabulary of the benchmark dataset — any other skill simply won't
// match anything in it, so we surface these as the selectable set.
const DATASET_SKILLS = [
  "Python",
  "SQL",
  "JavaScript",
  "HTML",
  "CSS",
  "Java",
  "C++",
  "AI",
  "Machine Learning",
  "Data Science",
];

const SCORE_TONE = (pct) =>
  pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-primary" : "bg-tertiary";

function ScoreBar({ label, value }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-secondary">
        <span>{label}</span>
        <span className="font-bold text-on-surface">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${SCORE_TONE(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RecommendationLabPage() {
  const { profile } = useProfile();

  const [selected, setSelected] = useState([]);
  const [matches, setMatches] = useState(null);
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [evalResult, setEvalResult] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    if (!profile?.skills?.length) return;
    const preselect = DATASET_SKILLS.filter((s) =>
      profile.skills.some((ps) => ps.trim().toLowerCase() === s.toLowerCase())
    );
    if (preselect.length) setSelected(preselect);
  }, [profile]);

  const toggleSkill = (skill) => {
    setSelected((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const runRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSyntheticRecommendations(selected, 10);
      setMatches(result.matches);
      setReason(result.reason);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const runEval = async () => {
    setEvalLoading(true);
    setError(null);
    try {
      const result = await getSyntheticEval(1000);
      setEvalResult(result);
    } catch (err) {
      setError(err);
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-margin-desktop pb-20 pt-16">
      <Link href="/jobs" className="mb-6 flex items-center gap-1 text-label-md text-secondary hover:text-primary">
        <Icon name="arrow_back" size={18} />
        Back to Jobs
      </Link>

      <header className="mb-10 mask-reveal">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-lg text-on-surface">Recommendation Lab</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary/10 px-3 py-1 text-label-sm font-bold uppercase tracking-wide text-tertiary">
            <Icon name="science" size={14} />
            Benchmark demo
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-body-lg text-secondary">
          Pick skills, get ranked recommendations scored purely on skill overlap — a live look at
          how our content-based scorer works, run against a public benchmark dataset rather than
          your real Nepal job matches on the main <Link href="/jobs" className="font-semibold text-primary hover:underline">Jobs</Link> page.
        </p>
      </header>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      <section className="mb-10 rounded-2xl border border-outline-variant bg-white p-8 mask-reveal">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-label-md font-bold uppercase tracking-wider text-secondary">
            Select skills <span className="text-primary">({selected.length})</span>
          </h3>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-label-sm font-bold text-secondary hover:text-primary"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mb-7 flex flex-wrap gap-3">
          {DATASET_SKILLS.map((skill) => {
            const active = selected.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`rounded-full border px-5 py-2.5 text-label-md transition-all active:scale-95 ${
                  active
                    ? "border-primary bg-primary text-on-primary font-bold shadow-md shadow-primary/20"
                    : "border-outline-variant text-on-surface hover:bg-surface-container-low"
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={runRecommend}
          disabled={loading || selected.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Icon name="progress_activity" size={18} className="animate-spin" />}
          {loading ? "Scoring..." : "Get Recommendations"}
        </button>
      </section>

      {reason === "no_skills" && (
        <p className="mb-8 text-sm text-secondary">Select at least one skill to get recommendations.</p>
      )}

      {!matches && !loading && (
        <div className="mb-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-14 text-center">
          <Icon name="query_stats" size={28} className="text-secondary" />
          <p className="text-body-md text-secondary">
            Select skills above and run the scorer to see ranked matches.
          </p>
        </div>
      )}

      {matches && matches.length > 0 && (
        <section className="mb-12 space-y-4">
          <h3 className="text-headline-md text-on-surface">Top Matches</h3>
          {matches.map((job, i) => (
            <div
              key={job.job_id}
              className="card-hover stagger-fade-in rounded-2xl border border-outline-variant bg-white p-6 transition-all"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-label-sm uppercase tracking-wider text-secondary">Job #{job.job_id}</p>
                  <p className="text-body-lg font-bold text-on-surface">{job.job_requirements}</p>
                </div>
                {job.dataset_recommended && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-700">
                    <Icon name="check_circle" size={13} />
                    Dataset: Recommended
                  </span>
                )}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl bg-surface-container-lowest p-4 sm:grid-cols-2">
                <ScoreBar label="Our content score" value={job.our_score} />
                <ScoreBar label="Dataset avg. Match_Score" value={job.dataset_match_score} />
              </div>

              <p className="mb-3 text-sm text-secondary">{job.explanation}</p>

              <div className="flex flex-wrap gap-2">
                {job.matched_skills.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Icon name="check" size={12} />
                    {s}
                  </span>
                ))}
                {job.missing_skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-medium text-on-tertiary-fixed"
                  >
                    missing: {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 mask-reveal">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="analytics" size={20} />
            </div>
            <div>
              <h3 className="text-headline-md text-on-surface">Benchmark Eval</h3>
              <p className="text-sm text-secondary">
                Compares our content score against this dataset&apos;s own labels.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={runEval}
            disabled={evalLoading}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-outline-variant bg-white px-5 py-2.5 text-label-md font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
          >
            {evalLoading && <Icon name="progress_activity" size={16} className="animate-spin" />}
            {evalLoading ? "Running..." : "Run Evaluation"}
          </button>
        </div>

        {evalResult && (
          <div className="mask-reveal">
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-outline-variant bg-white p-5 text-center">
                <p className="text-headline-lg font-bold text-on-surface">{evalResult.mae}</p>
                <p className="mt-1 text-xs text-secondary">
                  MAE vs Match_Score ({evalResult.sample_size} rows)
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant bg-white p-5 text-center">
                <p className="text-headline-lg font-bold text-on-surface">
                  {Math.round((evalResult.precision_when_recommended ?? 0) * 100)}%
                </p>
                <p className="mt-1 text-xs text-secondary">Precision vs Recommended=1</p>
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-white p-4 text-sm text-secondary">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-secondary" />
              {evalResult.note}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
