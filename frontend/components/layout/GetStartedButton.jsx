"use client";

import Link from "next/link";
import { useGetStartedHref } from "@/lib/auth-routing";
import Icon from "@/components/ui/Icon";

export default function GetStartedButton({ className, startLabel, returningLabel, showArrow = false }) {
  const { href, label, ready } = useGetStartedHref();

  if (!ready) {
    return (
      <span className={`${className} pointer-events-none opacity-70`} aria-hidden>
        {startLabel || "Get Started"}
      </span>
    );
  }

  const text =
    label === "Go to Dashboard" ? returningLabel || label : startLabel || label;

  return (
    <Link href={href} className={className}>
      {text}
      {showArrow && (
        <Icon
          name="arrow_forward"
          size={18}
          className="ml-1.5 inline-block align-middle transition-transform duration-200 group-hover:translate-x-1"
        />
      )}
    </Link>
  );
}
