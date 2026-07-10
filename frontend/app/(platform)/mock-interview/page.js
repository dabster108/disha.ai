"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import SessionDurationPicker from "@/components/practice/SessionDurationPicker";
import { useProfile } from "@/context/ProfileContext";
import { getInterviewHistory, getProfile, startInterview } from "@/lib/api";
import {
  INTERVIEW_DURATION_OPTIONS,
  inferInterviewTrack,
  storeInterviewSessionPrefs,
  suggestInterviewDifficulty,
} from "@/lib/interviewUtils";
import { storeInterviewWelcome } from "@/hooks/useVoiceInterview";

const DIFFICULTY_OPTIONS = ["auto", "easy", "medium", "hard"];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MockInterviewPage() {
  const { profile, profileId } = useProfile();
  const router = useRouter();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [difficulty, setDifficulty] = useState("auto");
  const [fullProfile, setFullProfile] = useState(null);

  const inferredTrack = inferInterviewTrack(fullProfile || profile || {});
  const suggestedDifficulty = suggestInterviewDifficulty(fullProfile || profile || {});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, profileData] = await Promise.all([
        getInterviewHistory(profileId),
        getProfile(profileId),
      ]);
      setSessions(data);
      setFullProfile(profileData);
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

  const handleStart = async () => {
    if (!durationMinutes) {
      setError(new Error("Choose a session length before starting."));
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const result = await startInterview(profileId);
      storeInterviewWelcome(result.session.id, result.welcome_message);
      storeInterviewSessionPrefs(result.session.id, {
        minutes: durationMinutes,
        difficulty: difficulty === "auto" ? suggestedDifficulty : difficulty,
      });
      router.push(`/mock-interview/active?session=${result.session.id}`);
    } catch (err) {
      setError(err);
      setStarting(false);
    }
  };

  const displayProfile = fullProfile || profile;

  return (
    <div className="mx-auto max-w-[1400px] px-margin-desktop pb-20 pt-24">
      <div className="mb-12 mask-reveal">
        <nav className="mb-2 flex items-center gap-2 text-secondary">
          <span className="text-label-sm uppercase tracking-widest">Workspace</span>
          <Icon name="chevron_right" className="text-xs" />
          <span className="text-label-sm uppercase tracking-widest text-on-surface">
            Mock Interview Simulation
          </span>
        </nav>
        <h1 className="text-display-lg tracking-tight text-on-surface">
          Mock Interview Simulation
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-secondary">
          A voice-first mock interview for the{" "}
          <span className="font-bold text-on-surface">{profile?.target_role}</span> role — DISHA
          speaks each question, you answer aloud, and get scored feedback after every turn.
        </p>
      </div>

      {error && (
        <div className="mb-8">
          <ErrorBanner message={error.message} onRetry={load} />
        </div>
      )}

      <section className="mb-section-gap rounded-xl border border-outline-variant bg-white p-10 ambient-shadow mask-reveal">
        <div className="flex flex-col gap-8">
          <div>
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-label-sm text-primary">
              New Session
            </span>
            <h2 className="mb-2 text-headline-lg text-on-surface">
              Start a live voice interview
            </h2>
            <p className="max-w-xl text-body-md text-secondary">
              DISHA will welcome you and ask questions aloud — tap the mic to answer, tap again to
              stop. Live captions show what&apos;s being said. Text mode is available if your mic
              is unavailable.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-label-md font-bold text-on-surface">
              Session length <span className="text-error">*</span>
            </h4>
            <SessionDurationPicker
              value={durationMinutes}
              onChange={setDurationMinutes}
              options={INTERVIEW_DURATION_OPTIONS}
            />
          </div>

          <div>
            <h4 className="mb-3 text-label-md font-bold text-on-surface">
              Difficulty focus <span className="font-normal text-secondary">(optional)</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((d) => (
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
                  {d === "auto" ? `Auto (${suggestedDifficulty})` : d}
                </button>
              ))}
            </div>
          </div>

          {displayProfile && (
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-sm text-secondary">
              <span className="mb-3 block text-label-md font-bold text-on-surface">
                Based on your profile
              </span>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Track:{" "}
                  <span className="ml-1 font-bold text-on-surface">
                    {inferredTrack === "tech" ? "Technical" : "Role-specific"}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Experience:{" "}
                  <span className="ml-1 font-bold text-on-surface">
                    {displayProfile.years_of_experience != null
                      ? `${displayProfile.years_of_experience} years`
                      : "Not specified"}
                  </span>
                </li>
                {displayProfile.skills?.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Skills:{" "}
                    <span className="ml-1 font-bold text-on-surface">
                      {displayProfile.skills.slice(0, 5).join(", ")}
                    </span>
                  </li>
                )}
                {displayProfile.experience?.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Recent role:{" "}
                    <span className="ml-1 font-bold text-on-surface">
                      {displayProfile.experience[0].title}
                      {displayProfile.experience[0].company
                        ? ` @ ${displayProfile.experience[0].company}`
                        : ""}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Icon name="mic" size={18} />
            Voice-first — microphone recommended; captions always on
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={starting || !durationMinutes}
            className="w-full shrink-0 rounded-xl bg-primary px-10 py-4 text-center text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary-container active:scale-95 disabled:opacity-60 md:w-fit"
          >
            {starting ? "Starting…" : "Start Live Voice Interview"}
          </button>
        </div>
      </section>

      <section className="mask-reveal">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-headline-md font-bold text-on-surface">Interview History</h3>
        </div>

        {loading ? (
          <LoadingState label="Loading your interview history..." />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="record_voice_over"
            title="No interviews yet"
            description="Start your first mock interview above to get scored, actionable feedback."
          />
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() =>
                  router.push(
                    session.status === "completed"
                      ? `/mock-interview/report?session=${session.id}`
                      : `/mock-interview/active?session=${session.id}`
                  )
                }
                className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-outline-variant bg-white p-5 text-left transition-colors hover:border-primary"
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-secondary transition-colors group-hover:bg-primary-fixed group-hover:text-primary">
                    <Icon name="description" />
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">
                      {session.target_role} •{" "}
                      {session.track === "tech" ? "Technical" : "Role-specific"}
                    </p>
                    <p className="text-sm text-secondary">
                      {formatDate(session.started_at)} •{" "}
                      {session.status === "completed" ? "Completed" : "In progress"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-on-surface">
                    {session.overall_score != null
                      ? `${Math.round(session.overall_score * 10)}%`
                      : "—"}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-secondary">
                    {session.status === "completed" ? "Overall Score" : "Continue"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
