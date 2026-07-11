"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { getSkillsCatalog } from "@/lib/api";
import {
  filterCatalogSkills,
  normalizeSkillKey,
  resolveCatalogSkill,
} from "@/lib/skills-catalog";

/**
 * @param {{ exclude?: string[], onAdd: (skill: string) => void, onCancel?: () => void, placeholder?: string }} props
 */
export default function CatalogSkillInput({ exclude = [], onAdd, onCancel, placeholder = "Type a skill…" }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [rejected, setRejected] = useState(null);
  const [aliasMap, setAliasMap] = useState({});
  const [allSkills, setAllSkills] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getSkillsCatalog().then((data) => {
      if (cancelled) return;
      setAliasMap(data.aliases || {});
      setAllSkills(data.all_skills || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const excludeLower = useMemo(() => new Set(exclude.map((s) => s.toLowerCase())), [exclude]);

  const suggestions = useMemo(
    () => filterCatalogSkills(draft, allSkills, excludeLower, 10),
    [draft, allSkills, excludeLower]
  );

  const tryAdd = (value) => {
    const canonical = resolveCatalogSkill(value, { aliasMap, allSkills });
    if (!canonical) {
      setRejected(value.trim());
      return;
    }
    if (excludeLower.has(canonical.toLowerCase())) {
      setDraft("");
      setRejected(null);
      setOpen(false);
      return;
    }
    setRejected(null);
    setDraft("");
    setOpen(false);
    onAdd(canonical);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    tryAdd(draft);
  };

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-outline-variant bg-surface-container-low p-4"
    >
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setRejected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline-variant bg-surface py-1 shadow-lg">
            {suggestions.map((skill) => (
              <li key={skill}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => tryAdd(skill)}
                  className="w-full px-4 py-2 text-left text-body-md text-on-surface hover:bg-surface-container-low"
                >
                  {skill}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {rejected && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-error">
          <Icon name="error" size={14} />
          &quot;{rejected}&quot; isn&apos;t in our skills catalog — pick a suggestion from the list.
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-label-md text-secondary hover:bg-surface-container-high"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => tryAdd(draft)}
          disabled={!normalizeSkillKey(draft)}
          className="rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
