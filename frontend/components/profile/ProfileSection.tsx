"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, X, Check } from "lucide-react";

type ProfileSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  action?: ReactNode;
};

export function ProfileSection({
  id,
  title,
  description,
  children,
  editing,
  onEdit,
  onSave,
  onCancel,
  action,
}: ProfileSectionProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="profile-section scroll-mt-24 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-headline-md font-semibold text-on-surface">{title}</h2>
          {description && <p className="mt-1 text-body-md text-secondary">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={onSave}>
                <Check className="h-4 w-4" />
                Save
              </Button>
            </>
          ) : onEdit ? (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-label-sm uppercase tracking-wider text-secondary">{label}</p>
      {children}
    </div>
  );
}

export function ReadOnlyValue({ value }: { value: string }) {
  return <p className="text-body-md text-on-surface">{value || "—"}</p>;
}
