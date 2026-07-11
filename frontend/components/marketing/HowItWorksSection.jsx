"use client";

import dynamic from "next/dynamic";

const CareerScrollExperience = dynamic(() => import("./CareerScrollExperience"), {
  ssr: false,
  loading: () => (
    <div
      id="how-it-works"
      className="flex h-[calc(100dvh-68px)] w-full items-center justify-center bg-surface-container-lowest"
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto h-10 w-48 animate-pulse rounded-lg bg-surface-container-low" />
        <div className="mx-auto h-6 w-64 animate-pulse rounded-lg bg-surface-container-low" />
      </div>
    </div>
  ),
});

export default function HowItWorksSection() {
  return (
    <div id="how-it-works">
      <CareerScrollExperience />
    </div>
  );
}
