"use client";

import dynamic from "next/dynamic";

const HeroShowcase = dynamic(() => import("./HeroShowcase"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full animate-pulse rounded-2xl bg-surface-container-low sm:h-[520px] lg:h-[680px]" />
  ),
});

export default HeroShowcase;
