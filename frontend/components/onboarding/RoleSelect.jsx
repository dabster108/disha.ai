"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { CAREER_ROLES, filterCareerRoles, matchCareerRole } from "@/lib/careerRoles";

export default function RoleSelect({ value, onChange, suggested }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const matchedSuggestion = suggested ? matchCareerRole(suggested) : "";
  const options = filterCareerRoles(query, 14);

  const selectRole = (role) => {
    onChange(role);
    setQuery(role);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {matchedSuggestion && matchedSuggestion !== value && (
        <button
          type="button"
          onClick={() => selectRole(matchedSuggestion)}
          className="mb-2 flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-label-sm text-primary hover:bg-primary/15"
        >
          <Icon name="auto_awesome" size={14} />
          Use parsed suggestion: {matchedSuggestion}
        </button>
      )}
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
        />
        <input
          type="text"
          required
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search roles (e.g. Frontend Developer)"
          className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-9 pr-4 text-body-md focus:border-primary focus:outline-none"
          autoComplete="off"
        />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-outline-variant bg-white py-1 shadow-lg">
          {options.length === 0 ? (
            <li className="px-4 py-2 text-label-sm text-secondary">No matches — press Enter to use custom role</li>
          ) : (
            options.map((role) => (
              <li key={role}>
                <button
                  type="button"
                  onClick={() => selectRole(role)}
                  className={`w-full px-4 py-2 text-left text-body-md hover:bg-surface-container-low ${
                    role === value ? "font-semibold text-primary" : "text-on-surface"
                  }`}
                >
                  {role}
                </button>
              </li>
            ))
          )}
          {!CAREER_ROLES.includes(query) && query.trim().length >= 2 && (
            <li className="border-t border-outline-variant/50">
              <button
                type="button"
                onClick={() => selectRole(query.trim())}
                className="w-full px-4 py-2 text-left text-label-sm text-primary hover:bg-surface-container-low"
              >
                Use &quot;{query.trim()}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
