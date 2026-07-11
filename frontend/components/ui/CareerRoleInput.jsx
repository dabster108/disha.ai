"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { CAREER_ROLES, filterCareerRoles } from "@/lib/careerRoles";

export default function CareerRoleInput({
  onSelect,
  onCancel = undefined,
  exclude = [],
  placeholder = "Search roles…",
  inline = false,
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [rejected, setRejected] = useState(null);
  const containerRef = useRef(null);

  const excludeSet = new Set(exclude.map((g) => g.toLowerCase()));
  const options = filterCareerRoles(draft, 10).filter((r) => !excludeSet.has(r.toLowerCase()));

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const trySelect = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exact = CAREER_ROLES.find((r) => r.toLowerCase() === trimmed.toLowerCase());
    if (!exact) {
      setRejected(trimmed);
      return;
    }
    if (excludeSet.has(exact.toLowerCase())) {
      setDraft("");
      setRejected(null);
      setOpen(false);
      return;
    }
    setRejected(null);
    setDraft("");
    setOpen(false);
    onSelect(exact);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    trySelect(draft);
  };

  return (
    <div ref={containerRef} className="space-y-2">
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
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {open && options.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline-variant bg-surface py-1 shadow-lg">
            {options.map((role) => (
              <li key={role}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => trySelect(role)}
                  className="w-full px-4 py-2 text-left text-body-md text-on-surface hover:bg-surface-container-low"
                >
                  {role}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {rejected && (
        <p className="flex items-center gap-1.5 text-xs text-error">
          <Icon name="error" size={12} />
          &quot;{rejected}&quot; isn&apos;t a listed role — pick from the suggestions.
        </p>
      )}

      {!inline && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-xs text-secondary hover:bg-surface-container-low"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => trySelect(draft)}
            disabled={!draft.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
