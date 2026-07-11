"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import HeroCTA from "@/components/layout/HeroCTA";

gsap.registerPlugin(ScrollTrigger);

const ACCENT = "#0050cb";
const INK = "#1a1c1b";

const MARKET_SKILLS = [
  "Git & Version Control",
  "Python",
  "REST APIs",
  "Docker",
  "SQL & Databases",
  "Authentication",
  "System Design",
  "Testing",
  "Deployment",
];

const MISSING = new Set([2, 3, 4, 5, 7]);

const ROADMAP = [
  { label: "Fundamentals", side: "top" },
  { label: "Core Skills", side: "bottom" },
  { label: "APIs & Auth", side: "top" },
  { label: "Databases", side: "bottom" },
  { label: "DevOps Basics", side: "top" },
  { label: "System Design", side: "bottom" },
  { label: "Interview Prep", side: "top" },
];

const NODE_GAP = 320;
const NODE_START_X = 200;
const CENTER_Y = 300;
const OFFSET_Y = 110;
const CURVE_TENSION = 0.42;

function getRoadmapPoints() {
  const points = [{ x: NODE_START_X, y: CENTER_Y }];

  ROADMAP.forEach((n, i) => {
    points.push({
      x: NODE_START_X + (i + 1) * NODE_GAP,
      y: n.side === "top" ? CENTER_Y - OFFSET_Y : CENTER_Y + OFFSET_Y,
    });
  });

  points.push({
    x: NODE_START_X + (ROADMAP.length + 1) * NODE_GAP,
    y: CENTER_Y,
  });

  return points;
}

/** Smooth horizontal-tangent cubic segments — clean sine-wave between alternating nodes */
function buildRoadmapPath() {
  const points = getRoadmapPoints();
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    d += ` C ${p0.x + dx * CURVE_TENSION} ${p0.y}, ${p1.x - dx * CURVE_TENSION} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  return d;
}

const ROADMAP_PATH = buildRoadmapPath();
const ROADMAP_WIDTH = NODE_START_X + (ROADMAP.length + 1) * NODE_GAP + 400;
const ROADMAP_HEIGHT = CENTER_Y * 2;

function Check({ filled }) {
  if (filled) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l5 5L20 7"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return <span className="block h-5 w-5 rounded-full border border-outline-variant bg-white" />;
}

function SectionLabel({ children }) {
  return (
    <div className="mb-3 mt-8 text-[10px] font-medium uppercase tracking-[0.28em] text-secondary">
      {children}
    </div>
  );
}

function PhaseLabel({ className, text, position }) {
  const pos = {
    "top-left": "top-10 left-6 md:left-10",
    "top-right": "top-10 right-6 md:right-10",
    "mid-right": "top-1/2 right-6 md:right-10 -translate-y-1/2",
    "mid-left": "top-1/2 left-6 md:left-10 -translate-y-1/2",
    "bottom-left": "bottom-10 left-6 md:left-10",
    "bottom-right": "bottom-10 right-6 md:right-10",
    "top-center": "top-16 left-1/2 -translate-x-1/2",
  };

  return (
    <div
      className={`phase-label pointer-events-none absolute z-40 opacity-0 ${pos[position]} ${className}`}
      style={{ transform: "translateY(-8px)" }}
    >
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-outline-variant" />
        <span className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary md:text-base">
          {text}
        </span>
      </div>
    </div>
  );
}

export default function CareerScrollExperience() {
  const rootRef = useRef(null);
  const auraRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const aura = auraRef.current;
    if (!root || !aura) return;

    let raf = 0;
    const onMove = (e) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        aura.style.transform = `translate(${x - 250}px, ${y - 250}px)`;
        aura.style.opacity = "1";
      });
    };
    const onLeave = () => {
      aura.style.opacity = "0";
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(rootRef);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top 68px",
          end: "+=8500",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      const showPhase = (sel, at) => {
        tl.to(q(".phase-label"), { opacity: 0, y: -8, duration: 0.25, ease: "power2.out" }, at);
        tl.fromTo(
          q(sel),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          ">"
        );
      };

      tl.to(q(".stage1"), { y: -60, opacity: 0, ease: "power2.inOut" }, 0.5);
      tl.fromTo(q(".phase-1"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, "<");

      tl.fromTo(
        q(".resume"),
        { yPercent: 100, scale: 0.92, opacity: 0 },
        { yPercent: 0, scale: 1, opacity: 1, ease: "power3.out", duration: 0.9 },
        "<0.1"
      );

      tl.fromTo(q(".laser"), { top: "0%", opacity: 0 }, { opacity: 1, duration: 0.05 }, "+=0.2");
      tl.to(q(".laser"), { top: "100%", ease: "none", duration: 1 });
      tl.to(q(".laser"), { opacity: 0, duration: 0.1 });

      tl.to(q(".resume"), { opacity: 0, y: -40, scale: 0.95, duration: 0.4 }, "+=0.2");

      showPhase(".phase-2", "<");
      tl.fromTo(q(".gap"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5 }, "<");
      tl.from(q(".gap-row-market"), { opacity: 0, x: -20, stagger: 0.04, duration: 0.25 }, "<0.1");
      tl.from(q(".gap-row-yours"), { opacity: 0, x: 20, stagger: 0.04, duration: 0.25 }, "<");
      tl.fromTo(
        q(".check-market"),
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.08, duration: 0.3, ease: "back.out(2.5)" },
        "+=0.1"
      );
      tl.fromTo(
        q(".check-yours"),
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.08, duration: 0.3, ease: "back.out(2.5)" },
        "<0.15"
      );
      tl.to({}, { duration: 0.8 });
      tl.to(q(".gap"), { opacity: 0, y: -30, duration: 0.4 });

      showPhase(".phase-3", "<");
      tl.fromTo(q(".roadmap"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

      const pathEl = rootRef.current?.querySelector(".roadmap-path");
      const pathLen = pathEl ? pathEl.getTotalLength() : 3000;
      if (pathEl) {
        pathEl.style.strokeDasharray = String(pathLen);
        pathEl.style.strokeDashoffset = String(pathLen);
      }

      tl.to(q(".roadmap-track"), { x: -(ROADMAP_WIDTH - 900), ease: "none", duration: 2.4 }, ">");
      tl.to(q(".roadmap-path"), { strokeDashoffset: 0, ease: "none", duration: 2.4 }, "<");
      tl.fromTo(
        q(".rm-node"),
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 2.4 / (ROADMAP.length + 1),
          duration: 0.3,
          ease: "back.out(2)",
        },
        "<"
      );
      tl.fromTo(
        q(".rm-card"),
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, stagger: 2.4 / (ROADMAP.length + 1), duration: 0.3 },
        "<"
      );

      showPhase(".phase-4", "-=0.5");
      tl.to(q(".destination-glow"), { opacity: 1, scale: 1.6, duration: 0.4 }, "<");
      tl.to(q(".roadmap"), { scale: 6, opacity: 0, ease: "power3.in", duration: 0.7 }, "+=0.2");

      showPhase(".phase-5", "<");
      tl.fromTo(
        q(".dashboard"),
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: 0.5 },
        "<0.1"
      );
      tl.from(q(".dash-el"), { opacity: 0, y: 20, stagger: 0.08, duration: 0.35 });
      tl.to({}, { duration: 0.8 });

      tl.fromTo(q(".welldone"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.2");
      tl.to({}, { duration: 0.5 });
      tl.to([q(".dashboard"), q(".welldone")], { opacity: 0, duration: 0.4 });

      showPhase(".phase-6", "<");
      tl.fromTo(q(".hired"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "<0.1");
      tl.from(q(".hired-el"), { opacity: 0, y: 20, stagger: 0.1, duration: 0.4 });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative h-[calc(100dvh-68px)] w-full overflow-hidden bg-surface-container-lowest"
      style={{ color: INK }}
    >
      <div
        ref={auraRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-20 h-[500px] w-[500px] rounded-full opacity-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${ACCENT}14 0%, ${ACCENT}08 30%, transparent 65%)`,
          mixBlendMode: "multiply",
        }}
      />

      <PhaseLabel className="phase-1" text="01 — Scan Resume" position="top-left" />
      <PhaseLabel className="phase-2" text="02 — Gap Finder" position="mid-right" />
      <PhaseLabel className="phase-3" text="03 — Customize Roadmap" position="bottom-left" />
      <PhaseLabel className="phase-4" text="04 — Final Goal" position="top-right" />
      <PhaseLabel className="phase-5" text="05 — Mock Interviews & Job Apply" position="bottom-right" />
      <PhaseLabel className="phase-6" text="06 — Dream Role" position="top-center" />

      <div className="stage1 absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-label-sm font-bold uppercase tracking-[0.24em] text-primary">
          How it works
        </p>
        <h2 className="text-display-lg-mobile font-semibold tracking-tight text-on-surface md:text-display-lg">
          Become Job Ready
        </h2>
        <p className="mt-6 text-lg font-light tracking-wide text-secondary md:text-2xl">
          Not Course Ready.
        </p>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <div
          className="resume relative w-[340px] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-10 opacity-0 shadow-[0_30px_80px_-30px_rgba(0,80,203,0.2)] md:w-[460px]"
          style={{ willChange: "transform, opacity", height: "min(88vh, 820px)" }}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/5 rounded-full bg-on-surface/80" />
              <div className="h-2 w-2/5 rounded-full bg-outline-variant" />
            </div>
          </div>

          <SectionLabel>Experience</SectionLabel>
          <div className="space-y-3">
            {[95, 82, 88, 70, 78, 62].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-outline-variant/70" style={{ width: `${w}%` }} />
            ))}
          </div>

          <SectionLabel>Skills</SectionLabel>
          <div className="space-y-3">
            {[90, 75, 82, 65].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-outline-variant/70" style={{ width: `${w}%` }} />
            ))}
          </div>

          <SectionLabel>Education</SectionLabel>
          <div className="space-y-3">
            {[85, 60, 70].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-outline-variant/70" style={{ width: `${w}%` }} />
            ))}
          </div>

          <div
            className="laser pointer-events-none absolute left-0 right-0 h-[2px] opacity-0"
            style={{
              top: 0,
              background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
              boxShadow: `0 0 20px ${ACCENT}, 0 0 40px ${ACCENT}`,
            }}
          />
        </div>
      </div>

      <div className="gap absolute inset-0 flex items-center justify-center px-8 opacity-0">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-8 text-xs font-medium uppercase tracking-[0.28em] text-secondary">
              Market Requirements
            </div>
            <ul className="space-y-4">
              {MARKET_SKILLS.map((s) => (
                <li key={s} className="gap-row-market flex items-center gap-4">
                  <span className="check-market inline-flex">
                    <Check filled />
                  </span>
                  <span className="text-base font-medium tracking-tight text-on-surface">{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-8 text-xs font-medium uppercase tracking-[0.28em] text-secondary">
              Your Skills
            </div>
            <ul className="space-y-4">
              {MARKET_SKILLS.map((s, i) => {
                const missing = MISSING.has(i);
                return (
                  <li key={s} className="gap-row-yours flex items-center gap-4">
                    {missing ? (
                      <span className="block h-5 w-5 rounded-md border border-dashed border-outline-variant bg-surface-container-low" />
                    ) : (
                      <span className="check-yours inline-flex">
                        <Check filled />
                      </span>
                    )}
                    <span
                      className={`text-base tracking-tight ${
                        missing ? "text-secondary" : "font-medium text-on-surface"
                      }`}
                    >
                      {s}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="roadmap absolute inset-0 flex items-center opacity-0">
        <div
          className="roadmap-track relative will-change-transform"
          style={{ width: ROADMAP_WIDTH, height: ROADMAP_HEIGHT }}
        >
          <svg
            width={ROADMAP_WIDTH}
            height={ROADMAP_HEIGHT}
            viewBox={`0 0 ${ROADMAP_WIDTH} ${ROADMAP_HEIGHT}`}
            className="absolute inset-0"
          >
            <path
              d={ROADMAP_PATH}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              className="roadmap-path"
              d={ROADMAP_PATH}
              fill="none"
              stroke={ACCENT}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }}
            />
          </svg>

          {ROADMAP.map((node, i) => {
            const cx = NODE_START_X + (i + 1) * NODE_GAP;
            const cy = node.side === "top" ? CENTER_Y - OFFSET_Y : CENTER_Y + OFFSET_Y;
            return (
              <div key={node.label}>
                <div
                  className="rm-node absolute z-10 h-3 w-3 rounded-full border border-outline-variant bg-white"
                  style={{ left: cx - 6, top: cy - 6 }}
                />
                <div
                  className="rm-card absolute whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium tracking-tight text-on-surface shadow-[0_2px_0_0_rgba(0,80,203,0.06)]"
                  style={{
                    left: cx,
                    top: node.side === "top" ? cy - 56 : cy + 20,
                    transform: "translateX(-50%)",
                  }}
                >
                  {i + 1}. {node.label}
                </div>
              </div>
            );
          })}

          <div
            className="absolute flex flex-col items-center gap-6"
            style={{
              left: NODE_START_X + (ROADMAP.length + 1) * NODE_GAP,
              top: CENTER_Y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative">
              <div
                className="destination-glow absolute inset-0 rounded-full opacity-0"
                style={{
                  background: `radial-gradient(circle, ${ACCENT}66 0%, transparent 70%)`,
                  filter: "blur(24px)",
                }}
              />
              <div
                className="career-pulse-node relative h-12 w-12 rounded-full"
                style={{
                  background: ACCENT,
                  boxShadow: `0 0 30px ${ACCENT}, 0 0 60px ${ACCENT}80`,
                }}
              />
            </div>
            <span className="whitespace-nowrap text-display-lg-mobile font-semibold tracking-tight text-on-surface md:text-display-lg">
              Dream Role
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard absolute inset-0 flex flex-col bg-surface-container-lowest opacity-0">
        <div className="dash-el flex items-center justify-between border-b border-outline-variant px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-on-surface">
              AI Technical Interview · Live
            </span>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-secondary">Session 01</div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-8 p-6 md:grid-cols-3 md:p-10">
          <div className="dash-el col-span-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 font-mono text-sm leading-relaxed md:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="h-2 w-2 rounded-full bg-outline-variant" />
                <div className="h-2 w-2 rounded-full bg-outline-variant" />
                <div className="h-2 w-2 rounded-full bg-outline-variant" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-secondary">solution.py</span>
            </div>
            <div className="space-y-2 text-on-surface-variant">
              <div>
                <span style={{ color: ACCENT }}>def</span> <span style={{ color: INK }}>solve</span>(input):
              </div>
              <div className="pl-6 text-secondary">{"# two-pointer approach"}</div>
              <div className="pl-6">
                <span style={{ color: ACCENT }}>seen</span> = {"{}"}
              </div>
              <div className="pl-6">
                <span style={{ color: ACCENT }}>for</span> i, val <span style={{ color: ACCENT }}>in</span>{" "}
                enumerate(input):
              </div>
              <div className="pl-12">seen[val] = i</div>
              <div className="pl-6">
                <span style={{ color: ACCENT }}>return</span> seen
              </div>
            </div>
          </div>

          <div className="dash-el flex flex-col gap-6">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
              <div className="absolute inset-4 rounded-lg border border-dashed border-outline-variant" />
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-[60%] rounded-full border border-outline-variant" />
              <div className="absolute left-1/2 top-1/2 h-24 w-32 -translate-x-1/2 translate-y-2 rounded-t-[3rem] border border-outline-variant" />
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                <span className="text-[10px] uppercase tracking-widest text-secondary">REC</span>
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
              <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">Signal</div>
              <div className="mt-4 flex h-8 items-end gap-1">
                {[3, 6, 4, 8, 5, 7, 4, 9, 6, 8, 5, 7, 4, 6, 5].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full"
                    style={{ height: `${h * 10}%`, background: ACCENT, opacity: 0.35 + h / 20 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="welldone pointer-events-none absolute inset-0 flex items-center justify-center opacity-0">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest px-14 py-10 shadow-[0_20px_60px_-30px_rgba(0,80,203,0.2)]">
            <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-secondary">
              Session Complete
            </div>
            <span className="text-headline-lg font-semibold tracking-tight text-on-surface md:text-display-sm-mobile">
              Well Done.
            </span>
          </div>
        </div>
      </div>

      <div className="hired absolute inset-0 flex flex-col items-center justify-center gap-8 bg-surface-container-lowest px-6 opacity-0">
        <div className="hired-el text-xs font-medium uppercase tracking-[0.32em] text-secondary">
          Offer Accepted
        </div>
        <h2 className="hired-el text-center text-display-lg-mobile font-semibold tracking-tight text-on-surface md:text-display-lg">
          Congrats, you&apos;ve been hired.
        </h2>
        <p className="hired-el max-w-xl text-center text-base font-light text-secondary md:text-lg">
          From resume to offer letter — the full journey, engineered by AI.
        </p>
        <HeroCTA
          className="hired-el mt-4 inline-flex rounded-full bg-primary px-8 py-4 text-sm font-medium tracking-wide text-on-primary shadow-[0_10px_40px_-10px_rgba(0,80,203,0.55)] transition-transform hover:scale-[1.02]"
          startLabel="Start Your Journey →"
          returningLabel="Go to Dashboard"
        />
      </div>
    </section>
  );
}
