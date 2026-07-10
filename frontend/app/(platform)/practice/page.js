"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { useProfile } from "@/context/ProfileContext";
import { getPracticeHistory, startPractice, suggestPracticeSkills, getProfile } from "@/lib/api";
import SessionDurationPicker from "@/components/practice/SessionDurationPicker";

const DIFFICULTIES = ["auto", "easy", "medium", "hard"];
const MAX_SKILLS = 3;

export default function PracticePage() {
  const { profileId } = useProfile();
  const router = useRouter();

  const [suggested, setSuggested] = useState([]);
  const [track, setTrack] = useState(null);
  const [selected, setSelected] = useState([]);
  const [difficulty, setDifficulty] = useState("auto");
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(15);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [suggestion, pastSessions, profileData] = await Promise.all([
        suggestPracticeSkills(profileId),
        getPracticeHistory(profileId),
        getProfile(profileId),
      ]);
      setSuggested(suggestion.suggested_skills);
      setTrack(suggestion.track);
      setSelected(suggestion.suggested_skills.slice(0, MAX_SKILLS));
      setHistory(pastSessions);
      setProfile(profileData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const toggleSkill = (skill) => {
    setSelected((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill);
      if (prev.length >= MAX_SKILLS) return prev;
      return [...prev, skill];
    });
  };

  const handleStart = async () => {
    if (selected.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startPractice(profileId, selected, difficulty);
      sessionStorage.setItem(`disha-practice-duration-${result.session_id}`, JSON.stringify({ minutes: durationMinutes }));
      router.push(`/practice/active?session=${result.session_id}`);
    } catch (err) {
      setError(err);
      setStarting(false);
    }
  };

  if (loading) return <LoadingState label="Finding skills to practice..." />;

  return (
    <div className="mx-auto max-w-5xl px-margin-desktop pb-20 pt-16">
      <header className="mb-12 mask-reveal">
        <h1 className="text-display-lg text-on-surface">Skill Practice</h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          Pick up to {MAX_SKILLS} skills and prove them with a real{" "}
          {track === "tech" ? "coding challenge" : "scenario question"} — AI-scored,
          pass at 7/10.
        </p>
      </header>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      {suggested.length === 0 ? (
        <EmptyState
          icon="sports_esports"
          title="No skills to practice yet"
          description="Add skills to your profile first, then come back here to test them."
        />
      ) : (
        <section className="mb-section-gap rounded-2xl border border-outline-variant bg-white p-10 ambient-shadow">
          <h3 className="mb-6 text-headline-md font-bold text-on-surface">
            Choose skills ({selected.length}/{MAX_SKILLS})
          </h3>
          <div className="mb-8 flex flex-wrap gap-3">
            {suggested.map((skill) => {
              const active = selected.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`rounded-full border px-5 py-2.5 text-label-md transition-all ${
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

          <h4 className="mb-3 text-label-md font-bold text-on-surface">Difficulty</h4>
          <div className="mb-8 flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border px-4 py-2 text-label-md capitalize ${
                  difficulty === d
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-outline-variant text-secondary hover:bg-surface-container-low"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <h4 className="mb-3 text-label-md font-bold text-on-surface">How long do you want to practice?</h4>
          <div className="mb-10">
            <SessionDurationPicker value={durationMinutes} onChange={setDurationMinutes} />
          </div>

          {profile && (
            <div className="mb-8 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-sm text-secondary">
              <span className="mb-3 block font-bold text-on-surface text-label-md">Based on your profile:</span>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Target role: <span className="font-bold text-on-surface ml-1">{profile.target_role || "Not specified"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Experience: <span className="font-bold text-on-surface ml-1">{profile.years_of_experience != null ? `${profile.years_of_experience} years` : "0 years"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Suggested: <span className="font-bold text-on-surface ml-1">{suggested.slice(0, 3).join(", ")}</span>
                </li>
              </ul>
            </div>
          )}

          <p className="mb-6 flex items-center gap-2 text-sm font-semibold text-tertiary">
            <Icon name="mic" size={18} />
            Microphone required for scenario questions — text fallback available
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={starting || selected.length === 0}
            className="w-full rounded-xl bg-primary py-4 text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container disabled:opacity-60 md:w-fit md:px-10"
          >
            {starting ? "Starting..." : "Start Timed Practice"}
          </button>
        </section>
      )}

      <section className="mask-reveal">
        <h3 className="mb-6 text-headline-md font-bold text-on-surface">Practice History</h3>
        {history.length === 0 ? (
          <EmptyState icon="history" title="No sessions yet" description="Your completed practice sessions will show up here." />
        ) : (
          <div className="space-y-4">
            {history.map((s) => (
              <Link
                key={s.id}
                href={`/practice/active?session=${s.id}`}
                className="flex items-center justify-between rounded-xl border border-outline-variant bg-white p-5 transition-colors hover:border-primary"
              >
                <div>
                  <p className="text-body-md font-bold text-on-surface">
                    {s.skills_selected.join(", ")}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-secondary">
                    {s.track === "tech" ? "Technical" : "Scenario"}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        s.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-tertiary-fixed text-on-tertiary-fixed"
                      }`}
                    >
                      {s.status}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-on-surface">
                    {s.overall_score != null ? s.overall_score.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-secondary">Score</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
