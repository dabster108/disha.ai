"use client";

import Icon from "@/components/ui/Icon";
import { EMPTY_EDUCATION } from "@/lib/demoProfile";

export default function EducationEditor({ entries, onChange }) {
  const updateEntry = (index, patch) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const addEntry = () => onChange([...entries, { ...EMPTY_EDUCATION }]);

  const removeEntry = (index) => {
    if (entries.length <= 1) {
      onChange([{ ...EMPTY_EDUCATION }]);
      return;
    }
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={index}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-label-sm font-semibold text-secondary">
              Education {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeEntry(index)}
              className="text-secondary hover:text-error"
              aria-label="Remove education entry"
            >
              <Icon name="delete" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-label-sm text-secondary">Degree</label>
              <input
                type="text"
                value={entry.degree || ""}
                onChange={(e) => updateEntry(index, { degree: e.target.value })}
                placeholder="BSc CSIT"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-label-sm text-secondary">Institution</label>
              <input
                type="text"
                value={entry.institution || ""}
                onChange={(e) => updateEntry(index, { institution: e.target.value })}
                placeholder="Tribhuvan University"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-label-sm text-secondary">Year</label>
              <input
                type="text"
                value={entry.year || ""}
                onChange={(e) => updateEntry(index, { year: e.target.value })}
                placeholder="2024"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
      >
        <Icon name="add" size={16} />
        Add education
      </button>
    </div>
  );
}
