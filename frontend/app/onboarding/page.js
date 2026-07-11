"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import Icon from "@/components/ui/Icon";
import ErrorBanner from "@/components/ui/ErrorBanner";
import LoadingState from "@/components/ui/LoadingState";
import EducationEditor from "@/components/onboarding/EducationEditor";
import ExperienceEditor from "@/components/onboarding/ExperienceEditor";
import RoleSelect from "@/components/onboarding/RoleSelect";
import SkillMultiSelect from "@/components/onboarding/SkillMultiSelect";
import { useProfile } from "@/context/ProfileContext";
import { createProfile, getProfileByClerk, uploadResume } from "@/lib/api";
import { matchCareerRole } from "@/lib/careerRoles";
import {
  EMPTY_EDUCATION,
  EMPTY_EXPERIENCE,
} from "@/lib/demoProfile";

const BUDGET_OPTIONS = [
  { value: "free", label: "Free resources only" },
  { value: "low", label: "NPR 1,000 - 5,000/month" },
  { value: "flexible", label: "Flexible / paid courses OK" },
];

const INITIAL_FORM = {
  full_name: "",
  email: "",
  phone: "",
  summary: "",
  skills: [],
  parsedSkills: [],
  education: [{ ...EMPTY_EDUCATION }],
  experience: [],
  target_role: "",
  suggested_target_role: "",
  location: "",
  years_of_experience: "",
  time_per_week: "",
  budget: "free",
};

function applyParsedToForm(parsed) {
  const education =
    parsed.education?.length > 0
      ? parsed.education.map((e) => ({
          degree: e.degree || "",
          institution: e.institution || "",
          year: e.year || "",
        }))
      : [{ ...EMPTY_EDUCATION }];

  const experience =
    parsed.experience?.length > 0
      ? parsed.experience.map((e) => ({
          title: e.title || "",
          company: e.company || "",
          start_date: e.start_date || "",
          end_date: e.end_date || "",
          description: e.description || "",
        }))
      : [];

  return {
    full_name: parsed.full_name || "",
    phone: parsed.phone || "",
    summary: parsed.summary || "",
    skills: parsed.skills || [],
    parsedSkills: parsed.skills || [],
    education,
    experience,
    target_role: matchCareerRole(parsed.suggested_target_role),
    suggested_target_role: parsed.suggested_target_role || "",
    years_of_experience:
      parsed.years_of_experience != null ? String(parsed.years_of_experience) : "",
  };
}

function cleanEducation(entries) {
  return entries
    .filter((e) => e.degree?.trim())
    .map((e) => ({
      degree: e.degree.trim(),
      institution: e.institution?.trim() || null,
      year: e.year?.trim() || null,
    }));
}

function cleanExperience(entries) {
  return entries
    .filter((e) => e.title?.trim())
    .map((e) => ({
      title: e.title.trim(),
      company: e.company?.trim() || null,
      start_date: e.start_date?.trim() || null,
      end_date: e.end_date?.trim() || null,
      description: e.description?.trim() || null,
    }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { setProfile, profileId, profile, profileReady, loading } = useProfile();

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [skillsSource, setSkillsSource] = useState("manual");
  const [extractionMethod, setExtractionMethod] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!profileReady || loading) return;
    if (profileId && profile) {
      router.replace("/dashboard");
    }
  }, [profileReady, loading, profileId, profile, router]);

  useEffect(() => {
    if (!user) return;
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      "";
    const name = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ");
    updateForm({
      full_name: name || "",
      email: email || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleUpload = async (file) => {
    setUploading(true);
    setError(null);
    setWarnings([]);
    try {
      const parsed = await uploadResume(file);
      setForm((prev) => ({ ...prev, ...applyParsedToForm(parsed) }));
      setSkillsSource("cv");
      setExtractionMethod(parsed.extraction);
      setWarnings(parsed.parse_warnings || []);
      setStep(2);
    } catch (err) {
      setError(err);
      setWarnings([
        "We couldn't parse your CV. Continue manually — your details won't be lost.",
      ]);
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
      if (!user?.id) {
        setError(new Error("Your sign-in is still loading. Please wait a moment and try again."));
        setSubmitting(false);
        return;
      }

      const clerkEmail =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress ||
        "";

      const payload = {
        clerk_user_id: user.id,
        full_name: form.full_name.trim() || null,
        email: clerkEmail || form.email.trim() || null,
        phone: form.phone.trim() || null,
        summary: form.summary.trim() || null,
        skills: form.skills,
        skills_source: skillsSource,
        target_role: form.target_role.trim(),
        location: form.location.trim() || null,
        years_of_experience:
          form.years_of_experience === "" ? null : Number(form.years_of_experience),
        time_per_week: form.time_per_week === "" ? null : Number(form.time_per_week),
        budget: form.budget || null,
        education: cleanEducation(form.education),
        experience: cleanExperience(form.experience),
      };

      let created;
      try {
        created = await createProfile(payload);
      } catch (err) {
        if (err?.status === 409) {
          const existing = await getProfileByClerk(user.id, clerkEmail || undefined);
          setProfile(existing);
          router.replace("/dashboard");
          return;
        }
        throw err;
      }
      setProfile(created);
      router.replace("/dashboard");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || !isSignedIn || !user?.id) {
    return <LoadingState label="Loading your account..." />;
  }

  if (!profileReady || loading || (profileId && profile)) {
    return <LoadingState label="Checking your profile..." />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <Link href="/">
          <h1 className="text-lg font-bold text-primary">DISHA AI</h1>
        </Link>
        <p className="mt-1 text-body-md text-secondary">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}. Upload your CV, then confirm your profile.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`h-1 w-14 rounded-full ${step >= s ? "bg-primary" : "bg-surface-container-high"}`}
          />
        ))}
      </div>

      {error && step === 1 && (
        <div className="mb-4">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSkillsSource("manual");
              setStep(2);
            }}
            className="mt-3 w-full rounded-xl border border-outline-variant py-2.5 text-label-md font-semibold hover:bg-surface-container-low"
          >
            Continue with manual entry
          </button>
        </div>
      )}

      {error && step === 2 && (
        <div className="mb-4">
          <ErrorBanner message={error.message} onRetry={() => setError(null)} />
        </div>
      )}

      {warnings.length > 0 && step === 2 && (
        <div className="mb-4 rounded-xl border border-tertiary-fixed bg-[#fff6f4] p-4">
          <div className="mb-2 flex items-center gap-2 text-tertiary">
            <Icon name="info" size={18} />
            <span className="text-label-md font-semibold">Review suggested</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-body-md text-secondary">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {extractionMethod && (
            <p className="mt-2 text-label-sm text-secondary">
              Text extracted via: {extractionMethod}
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="rounded-2xl border border-outline-variant bg-white p-8 text-center ambient-shadow">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="upload_file" size={28} />
          </div>
          <h2 className="mb-2 text-headline-md font-semibold text-on-surface">
            Upload your CV
          </h2>
          <p className="mb-6 text-body-md text-secondary">
            We&apos;ll extract your name, contact info, skills, education, and experience.
            PDF or DOCX.
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

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setSkillsSource("manual");
                setWarnings([]);
                setStep(2);
              }}
              className="text-label-md text-secondary hover:text-primary hover:underline"
            >
              Skip and enter manually
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-outline-variant bg-white p-8 ambient-shadow"
        >
          <h2 className="text-headline-md font-semibold text-on-surface">
            Confirm your profile
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-label-md font-semibold">Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => updateForm({ full_name: e.target.value })}
                className="w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold">Email</label>
              <input
                type="email"
                value={form.email}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-secondary focus:outline-none"
                title="This is your signed-in email and cannot be changed here"
              />
              <p className="mt-1 text-xs text-secondary">From your Clerk account — used to link your profile</p>
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateForm({ phone: e.target.value })}
                placeholder="+977 98XXXXXXXX"
                className="w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold">
                Years of experience
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.years_of_experience}
                onChange={(e) => updateForm({ years_of_experience: e.target.value })}
                className="w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-label-md font-semibold">
              Target role <span className="text-error">*</span>
            </label>
            <RoleSelect
              value={form.target_role}
              suggested={form.suggested_target_role}
              onChange={(role) => updateForm({ target_role: role })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-label-md font-semibold">
              Skills <span className="text-error">*</span>
            </label>
            <SkillMultiSelect
              skills={form.skills}
              parsedSkills={form.parsedSkills}
              targetRole={form.target_role}
              onChange={(skills) => updateForm({ skills })}
            />
          </div>

          <div>
            <label className="mb-2 block text-label-md font-semibold">Education</label>
            <EducationEditor
              entries={form.education}
              onChange={(education) => updateForm({ education })}
            />
          </div>

          <div>
            <label className="mb-2 block text-label-md font-semibold">
              Work experience
            </label>
            <ExperienceEditor
              entries={form.experience}
              onChange={(experience) => updateForm({ experience })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-label-md font-semibold">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateForm({ location: e.target.value })}
                placeholder="Kathmandu"
                className="w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold">Hours / week</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.time_per_week}
                onChange={(e) => updateForm({ time_per_week: e.target.value })}
                placeholder="10"
                className="w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-label-md font-semibold">Budget</label>
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ budget: opt.value })}
                  className={`rounded-xl border px-4 py-2 text-label-md ${
                    form.budget === opt.value
                      ? "border-primary bg-primary/10 font-semibold text-primary"
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
              className="rounded-xl border border-outline-variant px-5 py-3 text-label-md font-semibold hover:bg-surface-container-low"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-primary py-3 text-label-md font-semibold text-on-primary hover:bg-primary-container disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Continue to dashboard"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
