export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/journey", label: "My Journey", icon: "auto_awesome" },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/skill-gap", label: "Skill Gap", icon: "insights" },
  { href: "/roadmap", label: "Roadmap", icon: "route" },
  { href: "/learning", label: "Learning", icon: "menu_book" },
  { href: "/mock-interview", label: "Mock Interview", icon: "record_voice_over" },
  { href: "/practice", label: "Skill Practice", icon: "sports_esports" },
  { href: "/jobs", label: "Job Matches", icon: "work_outline" },
  { href: "/applications", label: "Applications", icon: "assignment" },
  // { href: "/profile", label: "Profile", icon: "person" },
];

export function isActivePath(pathname, href) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
