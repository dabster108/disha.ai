"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useProfile } from "@/context/ProfileContext";
import { createProfile, uploadResume } from "@/lib/api";

const BUDGET_OPTIONS = [
  { value: "free", label: "Free resources only" },
  { value: "low", label: "NPR 1,000 - 5,000/month" },
  { value: "flexible", label: "Flexible / paid courses OK" },
];

function SkillChips({ skills, onChange }) {
  const [draft, setDraft] = useState("");

  const addSkill = () => {
    const value = draft.trim();
    if (!value) return;
    if (!skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      onChange([...skills, value]);
    }
    setDraft("");
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-label-md text-primary"
          >
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="text-primary/60 hover:text-primary"
              aria-label={`Remove ${skill}`}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
          }}
          placeholder="Type a skill and press Enter (e.g. Python)"
          className="flex-1 rounded-xl border border-outline-variant bg-white px-4 py-3 text-body-md focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={addSkill}
          className="rounded-xl border border-outline-variant px-4 py-3 text-label-md font-bold text-on-surface hover:bg-surface-container-low"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setProfile } = useProfile();

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [skillsSource, setSkillsSource] = useState("manual");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    skills: [],
    target_role: "",
    location: "",
    years_of_experience: "",
    time_per_week: "",
    budget: "free",
  });

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleUpload = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const parsed = await uploadResume(file);
      updateForm({
        full_name: parsed.full_name || "",
        skills: parsed.skills || [],
        target_role: parsed.suggested_target_role || "",
        years_of_experience: parsed.years_of_experience ?? "",
      });
      setSkillsSource("cv");
      setStep(2);
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.skills.length === 0) {
      setError(new Error("Add at least one skill before continuing."));
      return;
    }
    if (!form.target_role.trim()) {
      setError(new Error("Target role is required."));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: form.full_name || null,
        email: form.email || null,
        skills: form.skills,
        skills_source: skillsSource,
        target_role: form.target_role.trim(),
        location: form.location || null,
        years_of_experience: form.years_of_experience === "" ? null : Number(form.years_of_experience),
        time_per_week: form.time_per_week === "" ? null : Number(form.time_per_week),
        budget: form.budget || null,
      };
      const created = await createProfile(payload);
      setProfile(created);
      router.push("/dashboard");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <Link href="/">
          <h1 className="text-headline-lg font-bold text-primary">DISHA AI</h1>
        </Link>
        <p className="mt-2 text-body-md text-secondary">
          Let&apos;s set up your profile so we can find your skill gap.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`h-1.5 w-16 rounded-full ${step >= s ? "bg-primary" : "bg-surface-container-high"}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      {step === 1 && (
        <div className="rounded-2xl border border-outline-variant bg-white p-10 text-center ambient-shadow">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="upload_file" size={32} />
          </div>
          <h2 className="mb-2 text-headline-md text-on-surface">Upload your CV</h2>
          <p className="mb-8 text-body-md text-secondary">
            We&apos;ll extract your skills and experience automatically. PDF or DOCX.
          </p>

          <label className="mb-4 block cursor-pointer rounded-xl border-2 border-dashed border-outline-variant p-8 text-secondary transition-colors hover:border-primary hover:text-primary">
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="progress_activity" className="animate-spin" />
                Parsing your resume...
              </span>
            ) : (
              <span>Click to choose a file</span>
            )}
          </label>

          <button
            type="button"
            onClick={() => {
              setSkillsSource("manual");
              setStep(2);
            }}
            className="text-label-md text-secondary hover:text-primary hover:underline"
          >
            Skip and enter details manually
          </button>
        </div>
      )}

      {step === 2 && (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-outline-variant bg-white p-10 ambient-shadow"
        >
          <h2 className="text-headline-md text-on-surface">Confirm your profile</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-label-md font-bold text-on-surface">Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => updateForm({ full_name: e.target.value })}
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md font-bold text-on-surface">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm({ email: e.target.value })}
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-label-md font-bold text-on-surface">
              Target role <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={form.target_role}
              onChange={(e) => updateForm({ target_role: e.target.value })}
              placeholder="e.g. Backend Developer"
              className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-label-md font-bold text-on-surface">
              Skills <span className="text-error">*</span>
            </label>
            <SkillChips skills={form.skills} onChange={(skills) => updateForm({ skills })} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-label-md font-bold text-on-surface">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateForm({ location: e.target.value })}
                placeholder="Kathmandu"
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md font-bold text-on-surface">Years of experience</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.years_of_experience}
                onChange={(e) => updateForm({ years_of_experience: e.target.value })}
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md font-bold text-on-surface">Hours / week</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.time_per_week}
                onChange={(e) => updateForm({ time_per_week: e.target.value })}
                placeholder="10"
                className="w-full rounded-xl border border-outline-variant px-4 py-3 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-label-md font-bold text-on-surface">Budget</label>
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ budget: opt.value })}
                  className={`rounded-xl border px-4 py-2.5 text-label-md ${
                    form.budget === opt.value
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-outline-variant text-secondary hover:bg-surface-container-low"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-outline-variant px-6 py-3.5 text-label-md font-bold text-on-surface hover:bg-surface-container-low"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-primary py-3.5 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Continue to dashboard"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
