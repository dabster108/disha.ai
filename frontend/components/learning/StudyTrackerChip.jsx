"use client";

import Icon from "@/components/ui/Icon";

export default function StudyTrackerChip({ active, pendingConfirm, onMarkDone, onDismiss, onConfirmYes, onConfirmNo }) {
  if (pendingConfirm) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-2xl border border-primary/30 bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="task_alt" className="text-primary" />
          <p className="text-label-md font-bold text-on-surface">Mark this resource complete?</p>
        </div>
        <p className="mb-4 truncate text-sm text-secondary">{pendingConfirm.title}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirmYes}
            className="flex-1 rounded-xl bg-primary py-2.5 text-label-md font-bold text-on-primary hover:bg-primary-container"
          >
            Yes, done
          </button>
          <button
            type="button"
            onClick={onConfirmNo}
            className="flex-1 rounded-xl border border-outline-variant py-2.5 text-label-md font-bold text-on-surface hover:bg-surface-container-low"
          >
            Not yet
          </button>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-full border border-outline-variant bg-white px-4 py-3 shadow-lg">
        <Icon name="menu_book" size={18} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
          Studying: {active.title}
        </span>
        <button
          type="button"
          onClick={onMarkDone}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary-container"
        >
          Mark done
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-secondary hover:text-on-surface"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  }

  return null;
}
