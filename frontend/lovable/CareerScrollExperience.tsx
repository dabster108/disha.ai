import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const ACCENT = "#06B6D4";
const INK = "#0F172A";

const MARKET_SKILLS = [
  "HTML & Semantic Markup",
  "Modern CSS / Tailwind",
  "TypeScript",
  "React & Hooks",
  "State Management",
  "REST & GraphQL APIs",
  "Testing (Vitest / RTL)",
  "System Design",
  "Performance Optimization",
];

// which of the skills the user is missing (index)
const MISSING = new Set([2, 4, 6, 7]);

const ROADMAP: { label: string; side: "top" | "bottom" }[] = [
  { label: "Fundamentals", side: "top" },
  { label: "TypeScript", side: "bottom" },
  { label: "React & Hooks", side: "top" },
  { label: "State & Data", side: "bottom" },
  { label: "APIs & Testing", side: "top" },
  { label: "System Design", side: "bottom" },
  { label: "Performance", side: "top" },
];

// Layout constants for the roadmap SVG
const NODE_GAP = 320; // px between nodes
const NODE_START_X = 200;
const CENTER_Y = 300;
const OFFSET_Y = 110;

function buildRoadmapPath() {
  let d = `M ${NODE_START_X} ${CENTER_Y}`;
  ROADMAP.forEach((n, i) => {
    const x = NODE_START_X + (i + 1) * NODE_GAP;
    const y = n.side === "top" ? CENTER_Y - OFFSET_Y : CENTER_Y + OFFSET_Y;
    const prevX = NODE_START_X + i * NODE_GAP;
    const midX = (prevX + x) / 2;
    d += ` C ${midX} ${CENTER_Y}, ${midX} ${y}, ${x} ${y}`;
    // return to center line before next
    const nextX = NODE_START_X + (i + 2) * NODE_GAP;
    if (i < ROADMAP.length - 1) {
      const midX2 = (x + nextX) / 2;
      d += ` C ${midX2} ${y}, ${midX2} ${CENTER_Y}, ${nextX} ${CENTER_Y}`;
    } else {
      // final leg to destination on center line
      const destX = x + NODE_GAP;
      d += ` C ${(x + destX) / 2} ${y}, ${(x + destX) / 2} ${CENTER_Y}, ${destX} ${CENTER_Y}`;
    }
  });
  return d;
}

const ROADMAP_PATH = buildRoadmapPath();
const ROADMAP_WIDTH = NODE_START_X + (ROADMAP.length + 1) * NODE_GAP + 400;
const ROADMAP_HEIGHT = CENTER_Y * 2;

function Check({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ background: "#10B981" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span className="block h-5 w-5 rounded-full border border-slate-300 bg-white" />;
}

export default function CareerScrollExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // Pointer-tracking aura
  useEffect(() => {
    const root = rootRef.current;
    const aura = auraRef.current;
    if (!root || !aura) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        aura.style.transform = `translate(${x - 250}px, ${y - 250}px)`;
        aura.style.opacity = "1";
      });
    };
    const onLeave = () => { aura.style.opacity = "0"; };
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
          start: "top top",
          end: "+=8500",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      // helper to swap phase labels
      const showPhase = (sel: string, at: string | number) => {
        tl.to(q(".phase-label"), { opacity: 0, y: -8, duration: 0.25, ease: "power2.out" }, at);
        tl.fromTo(q(sel), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ">");
      };

      // --- Stage 1: Intro fades out, phase 1 label appears ---
      tl.to(q(".stage1"), { y: -60, opacity: 0, ease: "power2.inOut" }, 0.5);
      tl.fromTo(q(".phase-1"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, "<");

      // --- Stage 2: Resume slides in ---
      tl.fromTo(
        q(".resume"),
        { yPercent: 100, scale: 0.92, opacity: 0 },
        { yPercent: 0, scale: 1, opacity: 1, ease: "power3.out", duration: 0.9 },
        "<0.1"
      );

      // Laser sweep on resume
      tl.fromTo(q(".laser"), { top: "0%", opacity: 0 }, { opacity: 1, duration: 0.05 }, "+=0.2");
      tl.to(q(".laser"), { top: "100%", ease: "none", duration: 1 });
      tl.to(q(".laser"), { opacity: 0, duration: 0.1 });

      // Resume exits
      tl.to(q(".resume"), { opacity: 0, y: -40, scale: 0.95, duration: 0.4 }, "+=0.2");

      // --- Stage 3: Gap Finder ---
      showPhase(".phase-2", "<");
      tl.fromTo(q(".gap"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5 }, "<");
      // Rows fade in first
      tl.from(q(".gap-row-market"), { opacity: 0, x: -20, stagger: 0.04, duration: 0.25 }, "<0.1");
      tl.from(q(".gap-row-yours"), { opacity: 0, x: 20, stagger: 0.04, duration: 0.25 }, "<");
      // Then checkmarks pop in with stagger
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
      tl.to({}, { duration: 0.8 }); // hold
      tl.to(q(".gap"), { opacity: 0, y: -30, duration: 0.4 });

      // --- Stage 4: Roadmap ---
      showPhase(".phase-3", "<");
      tl.fromTo(q(".roadmap"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

      // Get SVG path length for self-drawing
      const pathEl = rootRef.current?.querySelector(".roadmap-path") as SVGPathElement | null;
      const pathLen = pathEl ? pathEl.getTotalLength() : 3000;
      if (pathEl) {
        pathEl.style.strokeDasharray = String(pathLen);
        pathEl.style.strokeDashoffset = String(pathLen);
      }

      // Pan the roadmap horizontally AND draw the path in sync
      tl.to(q(".roadmap-track"), { x: -(ROADMAP_WIDTH - 900), ease: "none", duration: 2.4 }, ">");
      tl.to(q(".roadmap-path"), { strokeDashoffset: 0, ease: "none", duration: 2.4 }, "<");
      // Nodes appear as the line reaches them
      tl.fromTo(
        q(".rm-node"),
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 2.4 / (ROADMAP.length + 1), duration: 0.3, ease: "back.out(2)" },
        "<"
      );
      tl.fromTo(
        q(".rm-card"),
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, stagger: 2.4 / (ROADMAP.length + 1), duration: 0.3 },
        "<"
      );

      // --- Stage 4b: Final node ---
      showPhase(".phase-4", "-=0.5");
      tl.to(q(".destination-glow"), { opacity: 1, scale: 1.6, duration: 0.4 }, "<");
      tl.to(q(".roadmap"), { scale: 6, opacity: 0, ease: "power3.in", duration: 0.7 }, "+=0.2");

      // --- Stage 5: Interview (white theme) ---
      showPhase(".phase-5", "<");
      tl.fromTo(
        q(".dashboard"),
        { opacity: 0, scale: 1.05 },
        { opacity: 1, scale: 1, duration: 0.5 },
        "<0.1"
      );
      tl.from(q(".dash-el"), { opacity: 0, y: 20, stagger: 0.08, duration: 0.35 });
      tl.to({}, { duration: 0.8 });

      // Well done overlay
      tl.fromTo(q(".welldone"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.2");
      tl.to({}, { duration: 0.5 });
      tl.to([q(".dashboard"), q(".welldone")], { opacity: 0, duration: 0.4 });

      // --- Stage 6: Hired ---
      showPhase(".phase-6", "<");
      tl.fromTo(q(".hired"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "<0.1");
      tl.from(q(".hired-el"), { opacity: 0, y: 20, stagger: 0.1, duration: 0.4 });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden bg-white"
      style={{ color: INK, fontFamily: "'Inter', ui-sans-serif, system-ui" }}
    >
      {/* Pointer aura */}
      <div
        ref={auraRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-20 h-[500px] w-[500px] rounded-full opacity-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${ACCENT}14 0%, ${ACCENT}08 30%, transparent 65%)`,
          mixBlendMode: "multiply",
        }}
      />

      {/* ============ Phase labels (asymmetric) ============ */}
      <PhaseLabel className="phase-1" text="01 — Scan Resume" position="top-left" />
      <PhaseLabel className="phase-2" text="02 — Gap Finder" position="mid-right" />
      <PhaseLabel className="phase-3" text="03 — Customize Roadmap" position="bottom-left" />
      <PhaseLabel className="phase-4" text="04 — Final Goal" position="top-right" />
      <PhaseLabel className="phase-5" text="05 — Mock Interviews & Job Apply" position="bottom-right" />
      <PhaseLabel className="phase-6" text="06 — Dream Role" position="top-center" />

      {/* ============ Stage 1: Intro ============ */}
      <div className="stage1 absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="text-5xl font-semibold tracking-tight md:text-8xl"
          style={{ color: INK, fontFamily: "'Inter Tight', ui-sans-serif, system-ui" }}
        >
          Become Job Ready
        </h1>
        <p className="mt-6 text-lg font-light tracking-wide text-slate-400 md:text-2xl">
          Not Course Ready.
        </p>
      </div>

      {/* ============ Stage 2: Resume (taller) ============ */}
      <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
        <div
          className="resume relative w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-10 opacity-0 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] md:w-[460px]"
          style={{ willChange: "transform, opacity", height: "min(88vh, 820px)" }}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/5 rounded-full bg-slate-800/80" />
              <div className="h-2 w-2/5 rounded-full bg-slate-200" />
            </div>
          </div>

          <SectionLabel>Experience</SectionLabel>
          <div className="space-y-3">
            {[95, 82, 88, 70, 78, 62].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
            ))}
          </div>

          <SectionLabel>Skills</SectionLabel>
          <div className="space-y-3">
            {[90, 75, 82, 65].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
            ))}
          </div>

          <SectionLabel>Education</SectionLabel>
          <div className="space-y-3">
            {[85, 60, 70].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
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

      {/* ============ Stage 3: Gap Finder ============ */}
      <div className="gap absolute inset-0 flex items-center justify-center px-8 opacity-0">
        <div className="grid w-full max-w-5xl grid-cols-2 gap-16">
          <div>
            <div className="mb-8 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Market Requirements
            </div>
            <ul className="space-y-4">
              {MARKET_SKILLS.map((s) => (
                <li key={s} className="gap-row-market flex items-center gap-4">
                  <span className="check-market inline-flex">
                    <Check filled />
                  </span>
                  <span className="text-base font-medium tracking-tight text-slate-900">{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-8 text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              Your Skills
            </div>
            <ul className="space-y-4">
              {MARKET_SKILLS.map((s, i) => {
                const missing = MISSING.has(i);
                return (
                  <li key={s} className="gap-row-yours flex items-center gap-4">
                    {missing ? (
                      <span className="block h-5 w-5 rounded-md border border-dashed border-slate-300 bg-slate-50" />
                    ) : (
                      <span className="check-yours inline-flex">
                        <Check filled />
                      </span>
                    )}
                    <span
                      className={`text-base tracking-tight ${
                        missing ? "text-slate-400" : "font-medium text-slate-900"
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

      {/* ============ Stage 4: Roadmap ============ */}
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
            {/* faint guide (optional) */}
            <path
              d={ROADMAP_PATH}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* animated draw */}
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
                  className="rm-node absolute z-10 h-3 w-3 rounded-full border border-slate-300 bg-white"
                  style={{ left: cx - 6, top: cy - 6 }}
                />
                <div
                  className="rm-card absolute whitespace-nowrap rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium tracking-tight text-slate-900 shadow-[0_2px_0_0_rgba(15,23,42,0.06)]"
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

          {/* Destination */}
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
                className="relative h-12 w-12 rounded-full"
                style={{
                  background: ACCENT,
                  boxShadow: `0 0 30px ${ACCENT}, 0 0 60px ${ACCENT}80`,
                  animation: "pulseNode 2s ease-in-out infinite",
                }}
              />
            </div>
            <span
              className="whitespace-nowrap text-5xl font-semibold tracking-tight text-slate-900 md:text-6xl"
              style={{ fontFamily: "'Inter Tight', ui-sans-serif, system-ui" }}
            >
              Dream Role
            </span>
          </div>
        </div>
      </div>

      {/* ============ Stage 5: Interview (white minimal) ============ */}
      <div className="dashboard absolute inset-0 flex flex-col opacity-0 bg-white">
        <div className="dash-el flex items-center justify-between border-b border-slate-200 px-10 py-5">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
            <span
              className="text-xs font-medium uppercase tracking-[0.28em]"
              style={{ color: INK }}
            >
              AI Technical Interview · Live
            </span>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Session 01</div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-8 p-10 md:grid-cols-3">
          {/* Editor */}
          <div className="dash-el col-span-2 rounded-2xl border border-slate-200 bg-white p-8 font-mono text-sm leading-relaxed">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-200" />
                <div className="h-2 w-2 rounded-full bg-slate-200" />
                <div className="h-2 w-2 rounded-full bg-slate-200" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">solution.ts</span>
            </div>
            <div className="space-y-2 text-slate-700">
              <div><span style={{ color: ACCENT }}>function</span> <span style={{ color: INK }}>solve</span>(input) {"{"}</div>
              <div className="pl-6 text-slate-400">{"// two-pointer approach"}</div>
              <div className="pl-6"><span style={{ color: ACCENT }}>const</span> map = <span style={{ color: ACCENT }}>new</span> Map();</div>
              <div className="pl-6"><span style={{ color: ACCENT }}>for</span> (<span style={{ color: ACCENT }}>let</span> i = 0; i {"<"} input.length; i++) {"{"}</div>
              <div className="pl-12">map.set(input[i], i);</div>
              <div className="pl-6">{"}"}</div>
              <div className="pl-6"><span style={{ color: ACCENT }}>return</span> map;</div>
              <div>{"}"}</div>
            </div>
          </div>

          {/* Webcam + Signal */}
          <div className="dash-el flex flex-col gap-6">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="absolute inset-4 rounded-lg border border-dashed border-slate-300" />
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-[60%] rounded-full border border-slate-300" />
              <div className="absolute left-1/2 top-1/2 h-24 w-32 -translate-x-1/2 translate-y-2 rounded-t-[3rem] border border-slate-300" />
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                <span className="text-[10px] uppercase tracking-widest text-slate-500">REC</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Signal</div>
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

        {/* Well done overlay */}
        <div className="welldone pointer-events-none absolute inset-0 flex items-center justify-center opacity-0">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-14 py-10 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.2)]">
            <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400">
              Session Complete
            </div>
            <span
              className="text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ color: INK, fontFamily: "'Inter Tight', ui-sans-serif, system-ui" }}
            >
              Well Done.
            </span>
          </div>
        </div>
      </div>

      {/* ============ Stage 6: Hired ============ */}
      <div className="hired absolute inset-0 flex flex-col items-center justify-center gap-8 bg-white px-6 opacity-0">
        <div className="hired-el text-xs font-medium uppercase tracking-[0.32em] text-slate-400">
          Offer Accepted
        </div>
        <h2
          className="hired-el text-center text-5xl font-semibold tracking-tight md:text-7xl"
          style={{ color: INK, fontFamily: "'Inter Tight', ui-sans-serif, system-ui" }}
        >
          Congrats, you've been hired.
        </h2>
        <p className="hired-el max-w-xl text-center text-base font-light text-slate-500 md:text-lg">
          From resume to offer letter — the full journey, engineered by AI.
        </p>
        <button
          className="hired-el mt-4 rounded-full px-8 py-4 text-sm font-medium tracking-wide transition-transform hover:scale-[1.02]"
          style={{
            background: ACCENT,
            color: INK,
            boxShadow: `0 10px 40px -10px ${ACCENT}`,
          }}
        >
          Start Your Journey →
        </button>
      </div>

      <style>{`
        @keyframes pulseNode {
          0%, 100% { box-shadow: 0 0 30px ${ACCENT}, 0 0 60px ${ACCENT}80; }
          50% { box-shadow: 0 0 50px ${ACCENT}, 0 0 100px ${ACCENT}; }
        }
      `}</style>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
      {children}
    </div>
  );
}

function PhaseLabel({
  className,
  text,
  position,
}: {
  className: string;
  text: string;
  position:
    | "top-left"
    | "top-right"
    | "mid-right"
    | "mid-left"
    | "bottom-left"
    | "bottom-right"
    | "top-center";
}) {
  const pos: Record<string, string> = {
    "top-left": "top-10 left-10",
    "top-right": "top-10 right-10",
    "mid-right": "top-1/2 right-10 -translate-y-1/2",
    "mid-left": "top-1/2 left-10 -translate-y-1/2",
    "bottom-left": "bottom-10 left-10",
    "bottom-right": "bottom-10 right-10",
    "top-center": "top-16 left-1/2 -translate-x-1/2",
  };
  return (
    <div
      className={`phase-label pointer-events-none absolute z-40 opacity-0 ${pos[position]} ${className}`}
      style={{ transform: "translateY(-8px)" }}
    >
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-slate-300" />
        <span
          className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500"
          style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}