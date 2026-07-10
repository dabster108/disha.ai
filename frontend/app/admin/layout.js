"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { getStoredAdminKey, storeAdminKey, clearAdminKey, getAdminStats } from "@/lib/adminApi";
import logo from "@/components/images/logo.png";

const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "group" },
  { href: "/admin/scrape", label: "Scrape", icon: "cloud_sync" },
  { href: "/admin/jobs", label: "Jobs Corpus", icon: "work" },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/admin/skills", label: "Skills Catalog", icon: "school" },
];

function KeyGate({ onUnlock }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true);
    setError(null);
    storeAdminKey(key.trim());
    try {
      await getAdminStats();
      onUnlock();
    } catch (err) {
      clearAdminKey();
      setError(err.status === 401 ? "Invalid admin key." : err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-lowest px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-outline-variant bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Image src={logo} alt="DISHA AI" width={40} height={40} className="rounded-xl" priority />
          <div>
            <p className="text-headline-sm font-bold text-on-surface">DISHA Admin</p>
            <p className="text-xs text-secondary">Restricted access</p>
          </div>
        </div>
        <label className="mb-1.5 block text-label-md font-semibold text-on-surface">Admin key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="X-Admin-Key"
          autoFocus
          className="mb-3 w-full rounded-xl border border-outline-variant px-4 py-2.5 text-body-md focus:border-primary focus:outline-none"
        />
        {error && <p className="mb-3 text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={checking || !key.trim()}
          className="w-full rounded-xl bg-on-surface py-2.5 text-label-md font-bold text-white disabled:opacity-60"
        >
          {checking ? "Checking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [unlocked, setUnlocked] = useState(null); // null = checking, true/false after

  useEffect(() => {
    const key = getStoredAdminKey();
    if (!key) {
      setUnlocked(false);
      return;
    }
    getAdminStats()
      .then(() => setUnlocked(true))
      .catch(() => {
        clearAdminKey();
        setUnlocked(false);
      });
  }, []);

  if (unlocked === null) return null;
  if (!unlocked) return <KeyGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <aside className="flex w-64 shrink-0 flex-col border-r border-outline-variant bg-on-surface text-white">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <Image src={logo} alt="DISHA AI" width={28} height={28} className="rounded-lg" priority />
          <span className="text-headline-sm font-bold">DISHA Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-label-md font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-6">
          <button
            type="button"
            onClick={() => {
              clearAdminKey();
              setUnlocked(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-label-md font-medium text-white/60 hover:bg-white/5 hover:text-white"
          >
            <Icon name="logout" size={20} />
            Lock
          </button>
          <Link
            href="/dashboard"
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-label-md font-medium text-white/60 hover:bg-white/5 hover:text-white"
          >
            <Icon name="arrow_back" size={20} />
            Student app
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
