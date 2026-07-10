"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { getAdminStats } from "@/lib/adminApi";
import logo from "@/components/images/logo.png";

const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "group" },
  { href: "/admin/interviews", label: "Interviews", icon: "record_voice_over" },
  { href: "/admin/practice", label: "Practice", icon: "sports_esports" },
  { href: "/admin/gaps", label: "Skill Gaps", icon: "insights" },
  { href: "/admin/roadmaps", label: "Roadmaps", icon: "route" },
  { href: "/admin/learning", label: "Learning", icon: "menu_book" },
  { href: "/admin/scrape", label: "Scrape", icon: "cloud_sync" },
  { href: "/admin/jobs", label: "Jobs Corpus", icon: "work" },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/admin/skills", label: "Skills Catalog", icon: "school" },
];

function ConfigWarning() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md rounded-2xl border border-error/30 bg-error-container/20 p-8 text-center">
        <Icon name="warning" size={32} className="mx-auto mb-3 text-error" />
        <p className="text-headline-sm font-bold text-on-surface">Admin key not configured</p>
        <p className="mt-2 text-sm text-secondary">
          Set <code>NEXT_PUBLIC_ADMIN_API_KEY</code> in <code>frontend/.env.local</code> to the
          same value as the backend&apos;s <code>ADMIN_API_KEY</code>, then restart the dev
          server.
        </p>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [status, setStatus] = useState("checking"); // checking | ok | error

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ADMIN_API_KEY) {
      setStatus("unconfigured");
      return;
    }
    getAdminStats()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  if (status === "checking") return null;
  if (status === "unconfigured" || status === "error") return <ConfigWarning />;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-outline-variant bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Image src={logo} alt="DISHA AI" width={36} height={36} className="rounded-lg" priority />
            <div>
              <h1 className="text-headline-md font-bold text-primary">DISHA AI</h1>
              <p className="text-label-md text-secondary">Admin</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? "border-r-2 border-primary bg-surface-container-low font-bold text-primary"
                    : "font-medium text-secondary hover:bg-surface-container-low"
                }`}
              >
                <Icon name={item.icon} filled={active} size={20} />
                <span className="text-label-md">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 pt-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-secondary transition-colors hover:bg-surface-container-low"
          >
            <Icon name="arrow_back" size={20} />
            <span className="text-label-md">Student app</span>
          </Link>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
