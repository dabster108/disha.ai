"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { isActivePath, navItems } from "@/lib/navigation";
import logo from "@/components/images/logo.png";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-outline-variant bg-surface px-4 py-6">
      <div className="mb-10 px-2">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src={logo} alt="DISHA AI" width={36} height={36} className="rounded-lg" priority />
          <div>
            <h1 className="text-headline-md font-bold text-primary">DISHA AI</h1>
            <p className="text-label-md text-secondary">Student Workspace</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
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

      <div className="mt-auto space-y-1">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors hover:bg-surface-container-low ${
            pathname.startsWith("/settings") ? "font-bold text-primary" : "text-secondary"
          }`}
        >
          <Icon name="settings" size={20} />
          <span className="text-label-md">Settings</span>
        </Link>
        <Link
          href="/mock-interview"
          className="mt-4 block w-full rounded-xl bg-primary py-3 text-center text-label-md font-medium text-on-primary transition-all hover:bg-primary-container active:scale-95"
        >
          New Simulation
        </Link>
        <Link
          href="/admin"
          className="mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-outline transition-colors hover:text-secondary"
        >
          <Icon name="admin_panel_settings" size={14} />
          Admin
        </Link>
      </div>
    </aside>
  );
}
