"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8"
    >
      <div className="mb-6">
        <h2 className="text-headline-md font-semibold text-on-surface">{title}</h2>
        {description && <p className="mt-1 text-body-md text-secondary">{description}</p>}
      </div>
      {children}
    </motion.div>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-outline-variant py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <p className="font-medium text-on-surface">{label}</p>
        {description && <p className="text-sm text-secondary">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ThemeOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-label-md font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-outline-variant text-secondary hover:bg-surface-container-low"
      )}
    >
      {label}
    </button>
  );
}
