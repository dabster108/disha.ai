"use client";

import Link from "next/link";
import { useGetStartedHref } from "@/lib/auth-routing";

export default function GetStartedButton({ className, startLabel, returningLabel }) {
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
    </Link>
  );
}
