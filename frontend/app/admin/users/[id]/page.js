"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LoadingState from "@/components/ui/LoadingState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { getAdminUserDossier, updateVerification } from "@/lib/adminApi";
import { CACHE_TTL, loadWithCache, readCache, writeCache } from "@/lib/resource-cache";

const STATUS_OPTIONS = [
  { value: "verified", label: "Mark Verified", cls: "bg-green-600 hover:bg-green-700" },
  { value: "needs_review", label: "Needs Review", cls: "bg-amber-500 hover:bg-amber-600" },
  { value: "flagged", label: "Flag", cls: "bg-red-600 hover:bg-red-700" },
];

function Section({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon name={icon} size={18} className="text-primary" />
        <h3 className="text-headline-sm font-bold text-on-surface">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminUserDossierPage({ params }) {
  const { id } = use(params);
  const cacheKey = `admin:user:${id}`;
  const initial = readCache(cacheKey);
  const [dossier, setDossier] = useState(initial.data);
  const [loading, setLoading] = useState(!initial.data);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState(initial.data?.verification?.notes || "");
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!dossier) setLoading(true);
    setError(null);
    loadWithCache(cacheKey, () => getAdminUserDossier(id), CACHE_TTL.adminDetail)
      .then((d) => {
        setDossier(d);
        setNotes(d.verification?.notes || "");
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const setStatus = async (status) => {
    setSaving(true);
    try {
      const v = await updateVerification(id, status, notes);
      setDossier((d) => {
        const updated = { ...d, verification: v };
        // Write straight through so a revisit within the TTL window doesn't
        // show the pre-update verification status from cache.
        writeCache(cacheKey, updated, CACHE_TTL.adminDetail);
        return updated;
      });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !dossier) return <LoadingState label="Loading dossier..." />;
  if (error) return <ErrorBanner message={error.message} onRetry={load} />;
  if (!dossier) return null;

  const { profile, gap, interviews, practices, roadmap, roadmap_pct, job_matches, category_scores, verification } = dossier;
  const gapData = gap?.gap_data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/users" className="flex items-center gap-1 text-sm text-secondary hover:text-primary">
        <Icon name="arrow_back" size={16} />
        All users
      </Link>

      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant bg-white p-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-display-lg text-on-surface">{profile.full_name || "Anonymous"}</h1>
          <p className="text-body-md text-secondary">
            {profile.email || "No email"} • {profile.target_role} • {profile.location || "No location"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              disabled={saving}
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${opt.cls}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {verification?.status && verification.status !== "unreviewed" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface">
          Current status: <span className="font-bold uppercase">{verification.status}</span>
          {verification.updated_at && (
            <span className="text-secondary"> — {new Date(verification.updated_at).toLocaleString()}</span>
          )}
        </div>
      )}

      <Section title="Admin Notes" icon="edit_note">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes about this profile (visible to admins only)..."
          className="w-full rounded-xl border border-outline-variant p-3 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setStatus(verification?.status || "unreviewed")}
          disabled={saving}
          className="mt-2 rounded-lg border border-outline-variant px-4 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
        >
          Save notes
        </button>
      </Section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(category_scores).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-outline-variant bg-white p-5 text-center">
            <p className="text-headline-md font-bold text-on-surface">{value}</p>
            <p className="text-xs uppercase tracking-wider text-secondary">{key.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      <Section title="Profile" icon="person">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-secondary">Experience</p>
            <p className="font-semibold text-on-surface">{profile.years_of_experience ?? 0} yrs</p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Skills source</p>
            <p className="font-semibold text-on-surface">{profile.skills_source}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Budget</p>
            <p className="font-semibold text-on-surface">{profile.budget || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Hours/week</p>
            <p className="font-semibold text-on-surface">{profile.time_per_week ?? "—"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase text-secondary">Skills (catalog-filtered)</p>
          <div className="flex flex-wrap gap-1.5">
            {(profile.skills || []).map((s) => (
              <span key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {s}
              </span>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Skill Gap" icon="insights">
        {gapData ? (
          <div>
            <div className="mb-4 flex items-center gap-6">
              <div>
                <p className="text-headline-md font-bold text-primary">{gapData.readiness_score}%</p>
                <p className="text-xs text-secondary">Readiness</p>
              </div>
              <div>
                <p className="text-headline-md font-bold text-on-surface">{gapData.evidence?.accuracy_level || "—"}</p>
                <p className="text-xs text-secondary">Evidence accuracy</p>
              </div>
              <div>
                <p className="text-headline-md font-bold text-on-surface">{gap.jobs_analyzed}</p>
                <p className="text-xs text-secondary">Jobs analyzed</p>
              </div>
            </div>
            <p className="mb-2 text-xs uppercase text-secondary">Priority to learn</p>
            <div className="flex flex-wrap gap-1.5">
              {(gapData.priority_learn || []).slice(0, 6).map((p) => (
                <span key={p.skill} className="rounded-full bg-tertiary-fixed px-2.5 py-1 text-xs font-medium text-on-tertiary-fixed">
                  {p.skill} ({p.priority_score})
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">No skill gap analysis yet.</p>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Interview History" icon="record_voice_over">
          {interviews.length === 0 ? (
            <p className="text-sm text-secondary">No interviews yet.</p>
          ) : (
            <div className="space-y-2">
              {interviews.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/interviews/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-3 text-sm transition-colors hover:border-primary"
                >
                  <div>
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span className="text-secondary">{new Date(s.started_at).toLocaleDateString()}</span>
                    <span className="ml-2 text-secondary">{s.turn_count} turns</span>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-on-surface">{s.overall_score != null ? `${s.overall_score}/10` : "—"}</span>
                    <Icon name="chevron_right" size={18} className="text-secondary" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Practice History" icon="sports_esports">
          {practices.length === 0 ? (
            <p className="text-sm text-secondary">No practice sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {practices.map((s) => (
                <div key={s.id} className="rounded-lg border border-outline-variant/60 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span className="font-bold text-on-surface">{s.overall_score != null ? `${s.overall_score}/10` : "—"}</span>
                  </div>
                  <p className="text-secondary">{(s.skills_selected || []).join(", ")}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Roadmap" icon="route">
        {roadmap ? (
          <div className="flex items-center gap-6">
            <div>
              <p className="text-headline-md font-bold text-primary">{roadmap_pct}%</p>
              <p className="text-xs text-secondary">Complete</p>
            </div>
            <div>
              <p className="text-headline-md font-bold text-on-surface">{roadmap.total_weeks ?? "—"}</p>
              <p className="text-xs text-secondary">Total weeks</p>
            </div>
            <div>
              <p className="text-headline-md font-bold text-on-surface">{roadmap.status}</p>
              <p className="text-xs text-secondary">Status</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">No roadmap generated yet.</p>
        )}
      </Section>

      <Section title="Job Matches Preview" icon="work">
        {job_matches.length === 0 ? (
          <p className="text-sm text-secondary">No job matches available.</p>
        ) : (
          <div className="space-y-2">
            {job_matches.map((j, i) => (
              <div key={`${j.title}-${i}`} className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-3 text-sm">
                <div>
                  <p className="font-semibold text-on-surface">{j.title}</p>
                  <p className="text-secondary">{j.company}</p>
                </div>
                <span className="font-bold text-primary">{j.match_score}%</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
