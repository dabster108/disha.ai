"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { SUGGESTED_SKILL_CHIPS } from "@/lib/demoProfile";

export default function SkillMultiSelect({ skills, onChange, parsedSkills = [] }) {
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    const pool = [...parsedSkills, ...SUGGESTED_SKILL_CHIPS];
    const selected = new Set(skills.map((s) => s.toLowerCase()));
    return [...new Set(pool)].filter((s) => s && !selected.has(s.toLowerCase()));
  }, [parsedSkills, skills]);

  const toggleSkill = (skill) => {
    const lower = skill.toLowerCase();
    if (skills.some((s) => s.toLowerCase() === lower)) {
      onChange(skills.filter((s) => s.toLowerCase() !== lower));
    } else {
      onChange([...skills, skill]);
    }
  };

  const addSkill = () => {
    const value = draft.trim();
    if (!value) return;
    if (!skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      onChange([...skills, value]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => toggleSkill(skill)}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-label-md text-on-primary"
          >
            {skill}
            <Icon name="close" size={14} />
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-label-sm text-secondary">Suggested from your CV — tap to add</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-label-md text-on-surface hover:border-primary hover:text-primary"
              >
                + {skill}
              </button>
            ))}
          </div>
        </div>
      )}

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
          placeholder="Type a skill and press Enter"
          className="flex-1 rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={addSkill}
          className="rounded-xl border border-outline-variant px-4 py-2.5 text-label-md font-semibold hover:bg-surface-container-low"
        >
          Add
        </button>
      </div>
    </div>
  );
}
