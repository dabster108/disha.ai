"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { getSkillsCatalog, getSkillsForRole } from "@/lib/api";

/** Casefold + collapse whitespace, mirrors the backend's normalize key shape. */
function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

export default function SkillMultiSelect({ skills, onChange, parsedSkills = [], targetRole = "" }) {
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState(null);
  const [roleSkills, setRoleSkills] = useState([]);
  const [aliasMap, setAliasMap] = useState({});
  const [allSkillsSet, setAllSkillsSet] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    getSkillsCatalog().then((data) => {
      if (cancelled) return;
      setAliasMap(data.aliases || {});
      setAllSkillsSet(new Set((data.all_skills || []).map((s) => s.toLowerCase())));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!targetRole?.trim()) {
      setRoleSkills([]);
      return;
    }
    let cancelled = false;
    getSkillsForRole(targetRole)
      .then((data) => {
        if (!cancelled) setRoleSkills(data.skills || []);
      })
      .catch(() => {
        if (!cancelled) setRoleSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [targetRole]);

  /** Resolve free text to its canonical catalog name, or null if unknown. */
  const resolveSkill = (value) => {
    const key = normalizeKey(value);
    if (!key) return null;
    if (aliasMap[key]) {
      const canonical = aliasMap[key];
      // aliasMap values are already canonical display names from the backend.
      return canonical;
    }
    if (allSkillsSet.has(key)) {
      // Exact catalog match — find the properly-cased version from roleSkills
      // or fall back to the typed value's own casing.
      const fromRole = roleSkills.find((s) => s.toLowerCase() === key);
      return fromRole || value.trim();
    }
    return null;
  };

  const suggestions = useMemo(() => {
    const pool = [...parsedSkills, ...roleSkills];
    const selected = new Set(skills.map((s) => s.toLowerCase()));
    return [...new Set(pool)].filter((s) => s && !selected.has(s.toLowerCase()));
  }, [parsedSkills, roleSkills, skills]);

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
    const canonical = resolveSkill(value);
    if (!canonical) {
      setRejected(value);
      return;
    }
    setRejected(null);
    if (!skills.some((s) => s.toLowerCase() === canonical.toLowerCase())) {
      onChange([...skills, canonical]);
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
          <p className="mb-2 text-label-sm text-secondary">
            {targetRole ? `Common skills for ${targetRole} — tap to add` : "Suggested from your CV — tap to add"}
          </p>
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
          onChange={(e) => {
            setDraft(e.target.value);
            setRejected(null);
          }}
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
      {rejected && (
        <p className="flex items-center gap-1.5 text-sm text-error">
          <Icon name="error" size={14} />
          &quot;{rejected}&quot; isn&apos;t in our skills catalog yet — try a close match from the
          suggestions above, or a more standard name (e.g. &quot;React&quot; instead of &quot;Reactt&quot;).
        </p>
      )}
    </div>
  );
}
