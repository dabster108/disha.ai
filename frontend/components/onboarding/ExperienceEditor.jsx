"use client";

import Icon from "@/components/ui/Icon";
import { EMPTY_EXPERIENCE } from "@/lib/demoProfile";

export default function ExperienceEditor({ entries, onChange }) {
  const updateEntry = (index, patch) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const addEntry = () => onChange([...entries, { ...EMPTY_EXPERIENCE }]);

  const removeEntry = (index) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  if (entries.length === 0) {
    return (
      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
      >
        <Icon name="add" size={16} />
        Add work experience
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={index}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-label-sm font-semibold text-secondary">
              Experience {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeEntry(index)}
              className="text-secondary hover:text-error"
              aria-label="Remove experience entry"
            >
              <Icon name="delete" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-label-sm text-secondary">Title</label>
              <input
                type="text"
                value={entry.title || ""}
                onChange={(e) => updateEntry(index, { title: e.target.value })}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-sm text-secondary">Company</label>
              <input
                type="text"
                value={entry.company || ""}
                onChange={(e) => updateEntry(index, { company: e.target.value })}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-sm text-secondary">Start</label>
              <input
                type="text"
                value={entry.start_date || ""}
                onChange={(e) => updateEntry(index, { start_date: e.target.value })}
                placeholder="Jan 2023"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-label-sm text-secondary">End</label>
              <input
                type="text"
                value={entry.end_date || ""}
                onChange={(e) => updateEntry(index, { end_date: e.target.value })}
                placeholder="Present"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-label-sm text-secondary">Summary</label>
              <textarea
                value={entry.description || ""}
                onChange={(e) => updateEntry(index, { description: e.target.value })}
                rows={2}
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
        Add experience
      </button>
    </div>
  );
}
