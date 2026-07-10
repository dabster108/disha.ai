"use client";

export default function SessionDurationPicker({ value, onChange, options = [5, 10, 15, 20, 30] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((mins) => (
        <button
          key={mins}
          type="button"
          onClick={() => onChange(mins)}
          className={`rounded-full border px-5 py-2.5 text-label-md transition-all ${
            value === mins
              ? "border-primary bg-primary text-on-primary font-bold shadow-md shadow-primary/20"
              : "border-outline-variant text-on-surface hover:bg-surface-container-low"
          }`}
        >
          {mins} mins
        </button>
      ))}
    </div>
  );
}
