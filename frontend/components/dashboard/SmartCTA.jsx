"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * Rule-driven primary CTA. The "next action" is computed by the journey state
 * engine (backend or frontend) — this component just renders it and stays in
 * sync with the QuickLinksRow and Journey page.
 */
export default function SmartCTA({ nextAction, size = "lg" }) {
  if (!nextAction) return null;
  const { label, description, href } = nextAction;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between gap-4 rounded-2xl bg-primary px-6 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-[0.99]",
        size === "lg" ? "py-5" : "py-3 text-label-md"
      )}
    >
      <span className="flex flex-col items-start">
        <span className="flex items-center gap-2">
          <Icon name="auto_awesome" filled size={size === "lg" ? 22 : 18} className="text-on-primary" />
          {label}
        </span>
        {description && size === "lg" && (
          <span className="mt-1 text-sm font-normal text-on-primary/80">{description}</span>
        )}
      </span>
      <Icon
        name="arrow_forward"
        size={size === "lg" ? 24 : 18}
        className="text-on-primary transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
