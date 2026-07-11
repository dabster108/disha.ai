"use client";

import Image from "next/image";
import Link from "next/link";
import GetStartedButton from "@/components/layout/GetStartedButton";
import logo from "@/components/images/logo.png";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

export default function MarketingHeader() {
  return (
    <header className="fixed top-0 z-50 h-[72px] w-full border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-headline-md font-bold tracking-tight text-on-surface"
        >
          <Image src={logo} alt="DISHA AI" width={32} height={32} className="rounded-lg" priority />
          DISHA AI
        </Link>
        <div className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-label-md text-on-surface-variant transition-all duration-200 hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </div>
        <GetStartedButton
          className="rounded-full bg-primary-container px-6 py-2.5 text-label-md text-on-primary shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          startLabel="Get Started"
          returningLabel="Dashboard"
        />
      </nav>
    </header>
  );
}
