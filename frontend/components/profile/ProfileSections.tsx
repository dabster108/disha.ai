"use client";

import { useState } from "react";
import { Plus, Trash2, Star, ExternalLink } from "lucide-react";
import { ProfileSection, FieldGrid, Field, ReadOnlyValue } from "@/components/profile/ProfileSection";
import CatalogSkillInput from "@/components/ui/CatalogSkillInput";
import CareerRoleInput from "@/components/ui/CareerRoleInput";
import { inferSkillCategory } from "@/lib/skills-catalog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type {
  StudentProfileExtended,
  PersonalInfo,
  EducationEntry,
  ExperienceEntry,
  CareerGoal,
  SkillEntry,
  ProjectEntry,
  CertificationEntry,
  PortfolioLinks,
  CareerPreferences,
  PrivacySettings,
} from "@/types/profile";

type SectionProps = {
  data: StudentProfileExtended;
  onChange: (data: StudentProfileExtended) => void;
};

function useEditSection<T>(initial: T, onSave: (v: T) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const start = () => {
    setDraft(initial);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = () => {
    onSave(draft);
    setEditing(false);
  };
  return { editing, draft, setDraft, start, cancel, save };
}

export function PersonalInfoSection({ data, onChange }: SectionProps) {
  const { editing, draft, setDraft, start, cancel, save } = useEditSection(data.personal, (personal) =>
    onChange({ ...data, personal })
  );

  const fields: { key: keyof PersonalInfo; label: string }[] = [
    { key: "fullName", label: "Full Name" },
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "dateOfBirth", label: "Date of Birth" },
    { key: "gender", label: "Gender" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "province", label: "Province" },
    { key: "country", label: "Country" },
  ];

  return (
    <ProfileSection
      id="personal"
      title="Personal Information"
      description="Your contact details and location."
      editing={editing}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
    >
      <FieldGrid>
        {fields.map(({ key, label }) => (
          <Field key={key} label={label}>
            {editing ? (
              <Input
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            ) : (
              <ReadOnlyValue value={data.personal[key]} />
            )}
          </Field>
        ))}
      </FieldGrid>
    </ProfileSection>
  );
}

function CrudEducation({ data, onChange }: SectionProps) {
  const add = () => {
    const entry: EducationEntry = {
      id: `edu-${Date.now()}`,
      institution: "",
      degree: "",
      faculty: "",
      major: "",
      startDate: "",
      endDate: "",
      currentSemester: "",
      cgpa: "",
      description: "",
    };
    onChange({ ...data, education: [...data.education, entry] });
  };
  const update = (id: string, patch: Partial<EducationEntry>) => {
    onChange({
      ...data,
      education: data.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };
  const remove = (id: string) => {
    onChange({ ...data, education: data.education.filter((e) => e.id !== id) });
  };

  return (
    <ProfileSection
      id="education"
      title="Education"
      description="Academic background and qualifications."
      action={
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
    >
      <div className="space-y-4">
        {data.education.length === 0 ? (
          <p className="text-body-md text-secondary">No education entries yet.</p>
        ) : (
          data.education.map((edu) => (
            <div key={edu.id} className="rounded-xl border border-outline-variant p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-on-surface">{edu.degree || "Degree"}</h3>
                  <p className="text-sm text-secondary">{edu.institution}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(edu.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
              <FieldGrid>
                {(
                  [
                    ["institution", "Institution"],
                    ["degree", "Degree"],
                    ["faculty", "Faculty"],
                    ["major", "Major"],
                    ["startDate", "Start Date"],
                    ["endDate", "End Date"],
                    ["currentSemester", "Current Semester"],
                    ["cgpa", "CGPA"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Input value={edu[key]} onChange={(e) => update(edu.id, { [key]: e.target.value })} />
                  </Field>
                ))}
              </FieldGrid>
              <div className="mt-3">
                <Label>Description</Label>
                <Textarea
                  className="mt-1.5"
                  value={edu.description}
                  onChange={(e) => update(edu.id, { description: e.target.value })}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </ProfileSection>
  );
}

function CrudExperience({ data, onChange }: SectionProps) {
  const add = () => {
    onChange({
      ...data,
      experience: [
        ...data.experience,
        {
          id: `exp-${Date.now()}`,
          company: "",
          position: "",
          employmentType: "Full-time",
          location: "",
          startDate: "",
          endDate: "",
          description: "",
          technologies: [],
          achievements: [],
        },
      ],
    });
  };
  const update = (id: string, patch: Partial<ExperienceEntry>) => {
    onChange({
      ...data,
      experience: data.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };
  const remove = (id: string) => {
    onChange({ ...data, experience: data.experience.filter((e) => e.id !== id) });
  };

  return (
    <ProfileSection
      id="experience"
      title="Experience"
      description="Work history and professional roles."
      action={
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
    >
      <div className="space-y-4">
        {data.experience.map((exp) => (
          <div key={exp.id} className="rounded-xl border border-outline-variant p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-on-surface">{exp.position || "Position"}</h3>
                <p className="text-sm text-secondary">
                  {exp.company} · {exp.employmentType}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(exp.id)}>
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </div>
            <FieldGrid>
              {(
                [
                  ["company", "Company"],
                  ["position", "Position"],
                  ["employmentType", "Employment Type"],
                  ["location", "Location"],
                  ["startDate", "Start"],
                  ["endDate", "End"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input value={exp[key]} onChange={(e) => update(exp.id, { [key]: e.target.value })} />
                </Field>
              ))}
            </FieldGrid>
            <div className="mt-3 space-y-3">
              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1.5"
                  value={exp.description}
                  onChange={(e) => update(exp.id, { description: e.target.value })}
                />
              </div>
              <div>
                <Label>Technologies (comma-separated)</Label>
                <Input
                  className="mt-1.5"
                  value={exp.technologies.join(", ")}
                  onChange={(e) =>
                    update(exp.id, {
                      technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export function CareerGoalSection({ data, onChange }: SectionProps) {
  const { editing, draft, setDraft, start, cancel, save } = useEditSection(data.careerGoal, (careerGoal) =>
    onChange({ ...data, careerGoal, currentRole: careerGoal.dreamJob })
  );

  return (
    <ProfileSection
      id="career-goal"
      title="Career Goal"
      description="Where you want to go and how you want to work."
      editing={editing}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
    >
      <FieldGrid>
        <Field label="Dream Job">
          {editing ? (
            <CareerRoleInput
              inline
              onSelect={(role) => setDraft({ ...draft, dreamJob: role })}
              placeholder="Search roles (e.g. Backend Developer)"
            />
          ) : (
            <ReadOnlyValue value={data.careerGoal.dreamJob} />
          )}
          {editing && draft.dreamJob && (
            <p className="mt-2 text-sm text-primary">Selected: {draft.dreamJob}</p>
          )}
        </Field>
        <Field label="Preferred Industry">
          {editing ? (
            <Input
              value={draft.preferredIndustry}
              onChange={(e) => setDraft({ ...draft, preferredIndustry: e.target.value })}
            />
          ) : (
            <ReadOnlyValue value={data.careerGoal.preferredIndustry} />
          )}
        </Field>
        <Field label="Work Style">
          {editing ? (
            <select
              className="flex h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-md"
              value={draft.workStyle}
              onChange={(e) =>
                setDraft({ ...draft, workStyle: e.target.value as CareerGoal["workStyle"] })
              }
            >
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          ) : (
            <ReadOnlyValue value={data.careerGoal.workStyle} />
          )}
        </Field>
        <Field label="Expected Salary">
          {editing ? (
            <Input
              value={draft.expectedSalary}
              onChange={(e) => setDraft({ ...draft, expectedSalary: e.target.value })}
            />
          ) : (
            <ReadOnlyValue value={data.careerGoal.expectedSalary} />
          )}
        </Field>
      </FieldGrid>
      <div className="mt-4">
        <Field label="Career Objective">
          {editing ? (
            <Textarea
              value={draft.careerObjective}
              onChange={(e) => setDraft({ ...draft, careerObjective: e.target.value })}
            />
          ) : (
            <ReadOnlyValue value={data.careerGoal.careerObjective} />
          )}
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {data.careerGoal.targetCompanies.map((c) => (
          <Badge key={c} variant="outline">
            {c}
          </Badge>
        ))}
      </div>
    </ProfileSection>
  );
}

export function SkillsSection({ data, onChange }: SectionProps) {
  const [adding, setAdding] = useState(false);

  const remove = (id: string) => onChange({ ...data, skills: data.skills.filter((s) => s.id !== id) });

  const addSkill = (name: string) => {
    onChange({
      ...data,
      skills: [
        ...data.skills,
        {
          id: `skill-${Date.now()}`,
          name,
          category: inferSkillCategory(name),
          level: "Intermediate",
          yearsOfExperience: 1,
        },
      ],
    });
    setAdding(false);
  };

  return (
    <ProfileSection
      id="skills"
      title="Skills"
      description="Your skills from our catalog."
      action={
        !adding ? (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add Skill
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {data.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5"
              >
                <span className="text-label-md font-medium text-on-surface">{skill.name}</span>
                <button
                  type="button"
                  onClick={() => remove(skill.id)}
                  className="text-secondary hover:text-error"
                  aria-label={`Remove ${skill.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !adding && <p className="text-body-md text-secondary">No skills yet. Click Add Skill to get started.</p>
        )}

        {adding && (
          <CatalogSkillInput
            exclude={data.skills.map((s) => s.name)}
            onAdd={addSkill}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </ProfileSection>
  );
}

export function ProjectsSection({ data, onChange }: SectionProps) {
  const add = () => {
    onChange({
      ...data,
      projects: [
        ...data.projects,
        {
          id: `proj-${Date.now()}`,
          title: "",
          description: "",
          technologies: [],
          githubUrl: "",
          liveUrl: "",
          images: [],
          role: "",
          duration: "",
          featured: false,
        },
      ],
    });
  };
  const update = (id: string, patch: Partial<ProjectEntry>) => {
    onChange({ ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };
  const remove = (id: string) => onChange({ ...data, projects: data.projects.filter((p) => p.id !== id) });

  return (
    <ProfileSection
      id="projects"
      title="Projects"
      description="Portfolio projects and side work."
      action={
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {data.projects.map((proj) => (
          <div
            key={proj.id}
            className={`rounded-xl border p-5 ${proj.featured ? "border-primary/30 bg-primary/5" : "border-outline-variant"}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {proj.featured && <Star className="h-4 w-4 fill-primary text-primary" />}
                <h3 className="font-semibold text-on-surface">{proj.title || "Untitled"}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(proj.id)}>
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </div>
            <Textarea
              className="mb-3"
              value={proj.description}
              onChange={(e) => update(proj.id, { description: e.target.value })}
              placeholder="Description"
            />
            <Input
              className="mb-2"
              value={proj.title}
              onChange={(e) => update(proj.id, { title: e.target.value })}
              placeholder="Title"
            />
            <div className="flex flex-wrap gap-1.5">
              {proj.technologies.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {proj.githubUrl && (
                <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <label className="flex items-center gap-2 text-sm text-secondary">
                <Switch
                  checked={proj.featured}
                  onCheckedChange={(v) => update(proj.id, { featured: v })}
                />
                Featured
              </label>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export function CertificationsSection({ data, onChange }: SectionProps) {
  const add = () => {
    onChange({
      ...data,
      certifications: [
        ...data.certifications,
        {
          id: `cert-${Date.now()}`,
          certificate: "",
          organization: "",
          issueDate: "",
          expiryDate: "",
          credentialUrl: "",
          credentialId: "",
        },
      ],
    });
  };
  const update = (id: string, patch: Partial<CertificationEntry>) => {
    onChange({
      ...data,
      certifications: data.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };
  const remove = (id: string) =>
    onChange({ ...data, certifications: data.certifications.filter((c) => c.id !== id) });

  return (
    <ProfileSection
      id="certifications"
      title="Certifications"
      description="Professional credentials and licenses."
      action={
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
    >
      <div className="space-y-4">
        {data.certifications.map((cert) => (
          <div key={cert.id} className="rounded-xl border border-outline-variant p-5">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">{cert.certificate || "Certificate"}</h3>
              <Button variant="ghost" size="icon" onClick={() => remove(cert.id)}>
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </div>
            <FieldGrid>
              {(
                [
                  ["certificate", "Certificate"],
                  ["organization", "Organization"],
                  ["issueDate", "Issue Date"],
                  ["expiryDate", "Expiry Date"],
                  ["credentialUrl", "Credential URL"],
                  ["credentialId", "Credential ID"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input value={cert[key]} onChange={(e) => update(cert.id, { [key]: e.target.value })} />
                </Field>
              ))}
            </FieldGrid>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export function PortfolioSection({
  data,
  onChange,
  skillsSource,
  onResumeUpload,
}: SectionProps & {
  skillsSource?: string;
  onResumeUpload?: (file: File) => Promise<void>;
}) {
  const { editing, draft, setDraft, start, cancel, save } = useEditSection(data.portfolio, (portfolio) =>
    onChange({ ...data, portfolio })
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasResume = Boolean(data.portfolio.resumeFileName) || skillsSource === "cv";

  const handleFile = async (file: File | null) => {
    if (!file || !onResumeUpload) return;
    setUploading(true);
    setUploadError(null);
    try {
      await onResumeUpload(file);
    } catch {
      setUploadError("Could not process resume. Try a PDF or DOCX file.");
    } finally {
      setUploading(false);
    }
  };

  const links: { key: keyof PortfolioLinks; label: string }[] = [
    { key: "portfolioUrl", label: "Portfolio URL" },
    { key: "github", label: "GitHub" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "leetcode", label: "LeetCode" },
    { key: "kaggle", label: "Kaggle" },
    { key: "codeforces", label: "Codeforces" },
    { key: "hackerrank", label: "HackerRank" },
    { key: "medium", label: "Medium" },
    { key: "personalWebsite", label: "Personal Website" },
  ];

  return (
    <ProfileSection
      id="portfolio"
      title="Resume & Portfolio"
      description="Links and resume upload."
      editing={editing}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
    >
      <div className="mb-6 rounded-xl border border-dashed border-outline-variant p-6">
        {hasResume ? (
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-on-surface">
                {data.portfolio.resumeFileName || "Resume on file"}
              </p>
              <p className="text-sm text-secondary">
                Uploaded from your CV{skillsSource === "cv" ? " during onboarding" : ""}. Re-upload to refresh skills and profile.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-center text-body-md text-secondary">Drop your resume here or click to upload</p>
        )}
        <div className="mt-4 flex justify-center">
          <label
            className={`inline-flex cursor-pointer items-center rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high ${
              uploading || !onResumeUpload ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              disabled={uploading || !onResumeUpload}
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {uploading ? "Processing..." : hasResume ? "Re-upload Resume" : "Upload Resume"}
          </label>
        </div>
        {uploadError && <p className="mt-2 text-center text-sm text-error">{uploadError}</p>}
      </div>
      <FieldGrid>
        {links.map(({ key, label }) => (
          <Field key={key} label={label}>
            {editing ? (
              <Input value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
            ) : data.portfolio[key] ? (
              <a
                href={String(data.portfolio[key])}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-md text-primary hover:underline"
              >
                {String(data.portfolio[key])}
              </a>
            ) : (
              <ReadOnlyValue value="" />
            )}
          </Field>
        ))}
      </FieldGrid>
    </ProfileSection>
  );
}

export function CareerPreferencesSection({ data, onChange }: SectionProps) {
  const prefs = data.careerPreferences;
  const set = (patch: Partial<CareerPreferences>) =>
    onChange({ ...data, careerPreferences: { ...prefs, ...patch } });

  return (
    <ProfileSection id="career-preferences" title="Career Preferences" description="Job search preferences.">
      <FieldGrid>
        <Field label="Expected Salary">
          <Input value={prefs.expectedSalary} onChange={(e) => set({ expectedSalary: e.target.value })} />
        </Field>
        <Field label="Company Size">
          <Input value={prefs.preferredCompanySize} onChange={(e) => set({ preferredCompanySize: e.target.value })} />
        </Field>
      </FieldGrid>
      <div className="mt-4 flex flex-wrap gap-4">
        {(
          [
            ["internship", "Internship"],
            ["fullTime", "Full Time"],
            ["contract", "Contract"],
            ["immediateAvailability", "Immediate Availability"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-on-surface">
            <Switch checked={prefs[key]} onCheckedChange={(v) => set({ [key]: v })} />
            {label}
          </label>
        ))}
      </div>
    </ProfileSection>
  );
}

export function AiSummarySection({ data }: { data: StudentProfileExtended }) {
  const s = data.aiSummary;
  return (
    <ProfileSection
      id="ai-summary"
      title="AI Career Summary"
      description="Generated from your skill gap, interviews, and roadmap."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Job Readiness", value: `${s.jobReadiness}%` },
          { label: "Resume Score", value: `${s.resumeScore}%` },
          { label: "Best Match", value: s.bestMatchingRole },
          { label: "Job Ready In", value: s.estimatedJobReady },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <p className="text-label-sm text-secondary">{item.label}</p>
            <p className="mt-1 text-headline-md font-semibold text-on-surface">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-label-sm font-semibold text-secondary">Top Strengths</p>
          <div className="flex flex-wrap gap-2">
            {s.topStrengths.map((x) => (
              <Badge key={x} variant="success">
                {x}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-label-sm font-semibold text-secondary">Skills to Improve</p>
          <div className="flex flex-wrap gap-2">
            {s.skillsToImprove.map((x) => (
              <Badge key={x} variant="secondary">
                {x}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-label-sm font-semibold text-primary">Next Recommendation</p>
        <p className="mt-2 text-body-md text-on-surface">{s.nextRecommendation}</p>
        <p className="mt-2 text-sm text-secondary">Roadmap progress: {s.roadmapProgress}%</p>
      </div>
    </ProfileSection>
  );
}

export function ActivitySection({ data }: { data: StudentProfileExtended }) {
  const a = data.activity;
  const stats = [
    { label: "Learning Hours", value: a.learningHours },
    { label: "Projects", value: a.projectsCompleted },
    { label: "Mock Interviews", value: a.mockInterviews },
    { label: "Applications", value: a.applications },
    { label: "Certificates", value: a.certificates },
    { label: "Achievements", value: a.achievements },
  ];
  return (
    <ProfileSection id="activity" title="Activity" description="Your learning and career activity.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-outline-variant p-4 text-center">
            <p className="text-headline-md font-bold text-on-surface">{s.value}</p>
            <p className="mt-1 text-xs text-secondary">{s.label}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export function PrivacySection({ data, onChange }: SectionProps) {
  const set = (patch: Partial<PrivacySettings>) =>
    onChange({ ...data, privacy: { ...data.privacy, ...patch } });

  const toggles: { key: keyof PrivacySettings; label: string; desc: string }[] = [
    { key: "publicProfile", label: "Public Profile", desc: "Anyone with the link can view" },
    { key: "recruiterVisibility", label: "Recruiter Visibility", desc: "Visible to verified recruiters" },
    { key: "resumeVisibility", label: "Resume Visibility", desc: "Allow resume download" },
    { key: "universityVisibility", label: "University Visibility", desc: "Share with your institution" },
  ];

  return (
    <ProfileSection id="privacy" title="Privacy" description="Control who sees your profile.">
      <div className="space-y-4">
        {toggles.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant p-4">
            <div>
              <p className="font-medium text-on-surface">{label}</p>
              <p className="text-sm text-secondary">{desc}</p>
            </div>
            <Switch checked={data.privacy[key]} onCheckedChange={(v) => set({ [key]: v })} />
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export { CrudEducation as EducationSection, CrudExperience as ExperienceSection };
