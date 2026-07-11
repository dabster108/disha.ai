"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import Icon from "@/components/ui/Icon";
import GetStartedButton from "@/components/layout/GetStartedButton";
import logo from "@/components/images/logo.png";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
];

export default function MarketingHeader() {
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((item) => document.querySelector(item.href)).filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHash(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const showLogin = isLoaded && !isSignedIn;

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-outline-variant/50 bg-surface/90 shadow-[0_1px_12px_rgba(0,0,0,0.04)] backdrop-blur-md"
          : "border-b border-transparent bg-surface/70 backdrop-blur-sm"
      }`}
    >
      <nav className="mx-auto flex h-[68px] max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link
          href="/"
          className="flex items-center gap-2 text-headline-md font-bold tracking-tight text-on-surface"
        >
          <Image
            src={logo}
            alt="DISHA AI"
            width={30}
            height={30}
            className="rounded-lg transition-transform duration-200 hover:scale-105"
            priority
          />
          DISHA AI
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => {
            const active = activeHash === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`group relative py-2 text-label-md transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
                  active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {item.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-[1.5px] rounded-full bg-primary transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                  aria-hidden
                />
              </a>
            );
          })}
        </div>

        <div className="hidden items-center gap-5 md:flex">
          {showLogin && (
            <Link
              href="/sign-in"
              className="text-label-md font-medium text-on-surface-variant transition-colors duration-200 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              Log in
            </Link>
          )}
          <GetStartedButton
            className="group inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-md active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            startLabel="Let's start"
            returningLabel="Go to Dashboard"
          />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface transition-colors duration-200 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <Icon name={mobileOpen ? "close" : "menu"} size={24} />
        </button>
      </nav>

      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          className="fade-in-up visible border-t border-outline-variant/40 bg-surface px-margin-mobile pb-6 pt-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-11 items-center rounded-lg px-3 py-3 text-label-md transition-colors duration-200 hover:bg-surface-container-low ${
                  activeHash === item.href ? "font-bold text-primary" : "text-on-surface"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/40 pt-4">
            {showLogin && (
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-xl border border-outline-variant text-label-md font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-low"
              >
                Log in
              </Link>
            )}
            <GetStartedButton
              className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-label-md font-semibold text-on-primary transition-all duration-200 hover:bg-primary-container"
              startLabel="Let's start"
              returningLabel="Go to Dashboard"
            />
          </div>
        </div>
      )}
    </header>
  );
}
