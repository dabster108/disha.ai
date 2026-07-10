"use client";

import { useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";

const weeks = [
  {
    id: 1,
    status: "completed",
    title: "Foundations of Modern Web Architecture",
    hours: "12h",
    goals: [
      "Mastered DOM manipulation and event delegation patterns.",
      "Understand asynchronous patterns (Promises, Async/Await) in depth.",
      "Configured complex Webpack and Babel environments from scratch.",
    ],
    project: {
      name: "Dynamic Weather Engine",
      description:
        "Real-time weather data visualization using vanilla JS and custom UI components.",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDc5bCdt15hzh8p8o_xjrqohq7h6aYzT0NClWGDpP1KJ7Q0tPLdcY1f17TFEuW8wlfEzbtIzBmVSteBTfHzjyfhEHQxtd1etgOeqQrEiiczzjRANyeKXh5pQEEaAGuQf3DGY2BxKZIKYPV-DbT2pRp2d-BShMceCxZqVLCeK-Gx3IdzhRw0uzgi9bxRYc6E6RsDeg48-YrqYJLq3zR-QPRNGBSigQt0E-wsd9ke1HclIMZl5S49oja2qQ",
    },
  },
  {
    id: 2,
    status: "active",
    title: "Advanced Component Patterns & State",
    hours: "18h",
    expanded: true,
    modules: [
      {
        name: "Higher Order Components (HOCs)",
        desc: "Code reuse patterns in functional components.",
        done: true,
      },
      {
        name: "State Management with Redux Toolkit",
        desc: "Architecting scalable global state for enterprise apps.",
        active: true,
      },
      {
        name: "Custom Hooks & Side Effects",
        desc: "Optimizing performance with useMemo and useCallback.",
        locked: true,
      },
    ],
    project: {
      name: "Collaboration Hub",
      description:
        "Build a real-time Kanban board with drag-and-drop features and persistent storage.",
      tags: ["REACT", "FIREBASE", "TAILWIND"],
    },
  },
  {
    id: 3,
    status: "locked",
    title: "Testing & Performance Optimization",
    hours: "15h",
    unlockText:
      'Complete the "State Management" module in Week 2 to unlock these advanced topics.',
  },
  {
    id: 4,
    status: "locked",
    title: "CI/CD & Advanced Deployment",
    hours: "10h",
    unlockText: "Unlock criteria not yet met.",
  },
];

function WeekStatusIcon({ status }) {
  if (status === "completed") {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-100 bg-green-50 text-green-600">
        <Icon name="check_circle" filled />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="bolt" filled />
        <span className="absolute -right-1 -top-1 h-4 w-4 animate-pulse rounded-full border-2 border-white bg-primary" />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-secondary">
      <Icon name="lock" />
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    completed: "bg-green-100 text-green-700",
    active: "bg-primary text-white",
    locked: "bg-surface-container-highest text-secondary",
  };
  const labels = {
    completed: "COMPLETED",
    active: "IN PROGRESS",
    locked: "LOCKED",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function RoadmapPage() {
  const [expanded, setExpanded] = useState({ 2: true });

  const toggleWeek = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto max-w-container-max px-margin-desktop py-12">
      <div className="mb-12 flex items-center gap-6 rounded-2xl border border-outline-variant bg-white p-6 glass-highlight">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon name="auto_fix_high" filled />
        </div>
        <div className="flex-1">
          <h2 className="text-headline-md font-bold text-primary">
            Updated based on your progress
          </h2>
          <p className="text-body-md text-on-surface-variant">
            We&apos;ve adjusted Week 4 and 5 to include more Advanced React
            patterns based on your strong performance in the JavaScript
            fundamentals module.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-primary px-6 py-2 text-label-md text-white"
        >
          View Changes
        </button>
      </div>

      <div className="mb-16 flex items-end justify-between">
        <div>
          <h3 className="mb-2 text-display-lg text-on-surface">
            Your Career Roadmap
          </h3>
          <p className="max-w-2xl text-body-lg text-on-surface-variant">
            A curated, multi-week journey designed to bridge the gap between
            your current skills and a Senior Developer role.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">
              Current Progress
            </p>
            <p className="text-headline-md font-bold text-primary">
              32% Completed
            </p>
          </div>
          <div className="h-12 w-px bg-outline-variant" />
          <div className="text-right">
            <p className="mb-1 text-label-sm uppercase tracking-widest text-secondary">
              Target End Date
            </p>
            <p className="text-headline-md font-bold text-on-surface">
              Oct 14, 2024
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {weeks.map((week) => (
          <div
            key={week.id}
            className={`week-card group overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:shadow-ambient ${
              week.status === "active"
                ? "expanded border-2 border-primary shadow-[0_8px_32px_rgba(0,102,255,0.08)]"
                : "border-outline-variant"
            } ${expanded[week.id] ? "expanded" : ""}`}
          >
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-6 p-8 text-left"
              onClick={() => toggleWeek(week.id)}
            >
              <WeekStatusIcon status={week.status} />
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <span
                    className={`text-label-md uppercase tracking-wider ${week.status === "active" ? "text-primary" : "text-secondary"}`}
                  >
                    Week {week.id}
                  </span>
                  <StatusBadge status={week.status} />
                </div>
                <h4
                  className={`text-headline-md font-semibold ${week.status === "locked" ? "text-secondary" : "text-on-surface"} ${week.status === "active" ? "font-bold" : ""}`}
                >
                  {week.title}
                </h4>
              </div>
              <div className="mr-4 flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase text-secondary">
                    Hours
                  </p>
                  <p className="text-label-md">{week.hours}</p>
                </div>
                <Icon
                  name="expand_more"
                  className="expand-icon text-secondary transition-transform duration-300"
                />
              </div>
            </button>

            <div className="week-card-content overflow-hidden">
              <div className="min-h-0">
                <div className="mt-2 border-t border-outline-variant/30 p-8 pt-0">
                  {week.goals && (
                    <div className="grid grid-cols-12 gap-8">
                      <div className="col-span-7">
                        <h5 className="mb-3 text-label-md text-primary">
                          Learning Goals
                        </h5>
                        <ul className="space-y-3 text-body-md text-on-surface-variant">
                          {week.goals.map((g) => (
                            <li key={g} className="flex gap-2">
                              <span className="text-primary">•</span>
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {week.project && (
                        <div className="col-span-5 rounded-xl bg-surface-container-low p-6">
                          <h5 className="mb-3 text-label-md text-on-surface">
                            Completed Project
                          </h5>
                          <div className="flex items-start gap-4">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-dim">
                              <Image
                                src={week.project.image}
                                alt={week.project.name}
                                width={80}
                                height={80}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="mb-1 text-label-md font-bold">
                                {week.project.name}
                              </p>
                              <p className="mb-3 text-sm text-secondary">
                                {week.project.description}
                              </p>
                              <span className="flex items-center gap-1 text-sm font-bold text-primary">
                                View Repo{" "}
                                <Icon name="open_in_new" className="text-xs" />
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {week.modules && (
                    <div className="grid grid-cols-12 gap-12">
                      <div className="col-span-8">
                        <div className="mb-8">
                          <h5 className="mb-4 text-label-md uppercase tracking-widest text-primary">
                            Current Modules
                          </h5>
                          <div className="space-y-4">
                            {week.modules.map((m) => (
                              <div
                                key={m.name}
                                className={`flex items-center gap-4 rounded-xl border p-4 ${
                                  m.active
                                    ? "border-primary/30 bg-primary/5"
                                    : m.locked
                                      ? "border-outline-variant opacity-50"
                                      : "border-outline-variant bg-surface-bright"
                                }`}
                              >
                                <Icon
                                  name={
                                    m.done
                                      ? "check_circle"
                                      : m.active
                                        ? "progress_activity"
                                        : "radio_button_unchecked"
                                  }
                                  className={
                                    m.done
                                      ? "text-green-500"
                                      : m.active
                                        ? "animate-spin text-primary"
                                        : "text-secondary"
                                  }
                                />
                                <div className="flex-1">
                                  <p className="text-label-md font-bold">
                                    {m.name}
                                  </p>
                                  <p className="text-sm text-secondary">
                                    {m.desc}
                                  </p>
                                </div>
                                {m.active && (
                                  <button
                                    type="button"
                                    className="rounded-lg bg-primary px-4 py-1.5 text-sm text-white"
                                  >
                                    Resume
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        {week.project && (
                          <div>
                            <h5 className="mb-4 text-label-md uppercase tracking-widest text-primary">
                              Weekly Project
                            </h5>
                            <div className="flex items-center gap-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                              <div className="flex-1">
                                <h6 className="mb-1 text-headline-md font-bold text-on-surface">
                                  {week.project.name}
                                </h6>
                                <p className="mb-4 text-body-md text-secondary">
                                  {week.project.description}
                                </p>
                                <div className="flex gap-3">
                                  {week.project.tags.map((t) => (
                                    <span
                                      key={t}
                                      className="rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-outline-variant bg-white">
                                <Icon
                                  name="developer_board"
                                  className="text-4xl"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="col-span-4">
                        <div className="sticky top-24 rounded-2xl bg-surface-container p-6">
                          <h5 className="mb-4 text-label-md text-on-surface">
                            Quick Resources
                          </h5>
                          <div className="space-y-4">
                            {[
                              { icon: "menu_book", label: "React Patterns Docs" },
                              {
                                icon: "video_library",
                                label: "Advanced Redux (Video)",
                              },
                              { icon: "forum", label: "Internal Dev Forum" },
                            ].map((r) => (
                              <a
                                key={r.label}
                                href="#"
                                className="group flex items-center gap-3"
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary shadow-sm transition-colors group-hover:bg-primary group-hover:text-white">
                                  <Icon name={r.icon} />
                                </div>
                                <span className="text-label-md text-secondary transition-colors group-hover:text-primary">
                                  {r.label}
                                </span>
                              </a>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="mt-8 w-full rounded-xl border border-outline py-3 font-bold text-on-surface transition-colors hover:bg-white"
                          >
                            Ask AI Mentor
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {week.unlockText && (
                    <p className="text-body-md italic text-on-surface-variant">
                      {week.unlockText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 text-center">
        <button
          type="button"
          className="group inline-flex items-center gap-3 rounded-2xl border border-outline-variant bg-white px-10 py-4 font-bold text-on-surface shadow-sm transition-all hover:shadow-md"
        >
          <Icon
            name="auto_awesome"
            className="text-primary transition-transform group-hover:rotate-12"
          />
          Generate Next 4 Weeks
        </button>
      </div>

      <footer className="mt-24 flex h-24 items-center justify-between border-t border-outline-variant px-margin-desktop">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
            <Icon name="psychology" />
          </div>
          <div>
            <p className="text-label-md font-bold text-on-surface">
              AI Path Optimizer
            </p>
            <p className="text-xs text-secondary">
              Continuously monitoring your skill velocity.
            </p>
          </div>
        </div>
        <div className="mx-16 flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full w-[32%] rounded-full bg-primary shadow-[0_0_8px_rgba(0,102,255,0.4)]" />
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 text-label-md text-secondary transition-colors hover:text-primary"
        >
          Configuration Details
          <Icon name="info" />
        </button>
      </footer>
    </div>
  );
}
