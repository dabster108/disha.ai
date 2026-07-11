"use client";

import GetStartedButton from "@/components/layout/GetStartedButton";

export default function HeroCTA({ className, startLabel, returningLabel }) {
  return (
    <GetStartedButton
      className={className}
      startLabel={startLabel}
      returningLabel={returningLabel}
    />
  );
}
