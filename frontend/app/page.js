import Image from "next/image";
import MarketingFooter from "@/components/layout/MarketingFooter";
import MarketingHeader from "@/components/layout/MarketingHeader";
import HeroCTA from "@/components/layout/HeroCTA";
import FadeInObserver from "@/components/ui/FadeInObserver";
import Icon from "@/components/ui/Icon";
import logo from "@/components/images/logo.png";
import roadmapShot from "@/components/images/roadmap.png";
import HeroShowcase from "@/components/marketing/HeroShowcaseLoader";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import PricingSection from "@/components/marketing/PricingSection";

const institutions = [
  "KATHMANDU UNIVERSITY",
  "TRIBHUVAN UNI",
  "NCELL",
  "DEERWALK",
  "LEAPFROG",
];

const features = [
  {
    icon: "insights",
    title: "Skill Gap Analysis",
    description: "See exactly which skills stand between you and your target role.",
  },
  {
    icon: "route",
    title: "AI Roadmap",
    description: "A week-by-week path with real resources — not generic advice.",
  },
  {
    icon: "record_voice_over",
    title: "Mock Interview",
    description: "Practice with an AI interviewer and get scored like the real thing.",
  },
  {
    icon: "work_outline",
    title: "Job Matching",
    description: "Live job recommendations matched to your verified skills.",
  },
];

export default function Home() {
  return (
    <>
      <MarketingHeader />
      <FadeInObserver>
        <main className="pt-[68px]">
          {/* Hero */}
          <section className="relative mx-auto max-w-container-max overflow-hidden px-margin-mobile pb-6 pt-16 md:px-margin-desktop md:pt-20">
            <div
              aria-hidden
              className="bg-wash-drift pointer-events-none absolute -top-40 left-1/2 -z-10 h-[760px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,80,203,0.07),transparent_65%)]"
            />
            <div className="mx-auto max-w-2xl space-y-7 text-center">
              <div className="fade-in-up inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest py-1.5 pl-1.5 pr-4">
                <Image src={logo} alt="" width={20} height={20} className="rounded-full" />
                <span className="text-label-sm font-bold uppercase tracking-[0.12em] text-primary">
                  DISHA AI · Career Navigator
                </span>
              </div>

              <div className="overflow-hidden">
                <h1 className="mask-reveal text-display-lg-mobile leading-[1.1] md:text-display-lg">
                  Your future isn&apos;t uncertain. It just needs{" "}
                  <span className="text-primary">direction.</span>
                </h1>
              </div>
              <p className="fade-in-up mx-auto max-w-xl text-body-lg text-secondary">
                Nepal&apos;s AI-powered career navigator — turning your skill gaps into a
                clear, week-by-week roadmap to your first tech job.
              </p>
              <div className="fade-in-up flex flex-col items-center gap-4">
                <div className="flex flex-wrap justify-center gap-4">
                  <HeroCTA
                    className="group inline-flex items-center rounded-xl bg-primary px-8 py-4 text-label-md font-semibold text-on-primary shadow-[0_12px_30px_-10px_rgba(0,80,203,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-[0_16px_36px_-10px_rgba(0,80,203,0.5)]"
                    startLabel="Let's start"
                    returningLabel="Go to Dashboard"
                    showArrow
                  />
                  <a
                    href="#how-it-works"
                    className="rounded-xl border border-outline-variant px-8 py-4 text-label-md text-on-surface transition-all duration-200 hover:border-primary/40 hover:bg-surface-container-low"
                  >
                    See how it works
                  </a>
                </div>
                <p className="flex items-center gap-1.5 text-label-sm text-secondary">
                  <Icon name="check_circle" size={16} className="text-primary" filled />
                  Free to start · No credit card
                </p>
              </div>
            </div>

            <div className="fade-in-up relative mx-auto mt-12 max-w-6xl lg:mt-16">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
              />
              <HeroShowcase />
            </div>
          </section>

          {/* Trust strip */}
          <section className="border-b border-outline-variant/30 py-10">
            <div className="mx-auto flex max-w-container-max flex-col items-center gap-6 px-margin-mobile md:px-margin-desktop">
              <span className="text-label-sm uppercase tracking-[0.2em] text-secondary">
                Built for Nepal&apos;s tech students
              </span>
              <div className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]">
                <div className="animate-marquee flex whitespace-nowrap">
                  {[...institutions, ...institutions].map((name, i) => (
                    <div
                      key={`${name}-${i}`}
                      className="px-10 text-headline-md font-bold text-on-surface/35 transition-colors hover:text-on-surface"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Education gap stats */}
          <section id="about" className="bg-surface-container-low py-section-gap">
            <div className="mx-auto max-w-container-max space-y-16 px-margin-mobile text-center md:px-margin-desktop">
              <div className="mx-auto max-w-2xl space-y-6">
                <span className="text-label-sm uppercase tracking-widest text-primary">
                  The Education Gap
                </span>
                <h2 className="text-headline-lg">
                  Bridging the disconnect in Nepal&apos;s talent ecosystem.
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
                {[
                  {
                    stat: "70%",
                    text: "Of graduates struggle to find jobs matching their academic background.",
                  },
                  {
                    stat: "12M+",
                    text: "Data points analyzed to build our localized career mapping engine.",
                  },
                  {
                    stat: "500+",
                    text: "Global certifications mapped directly to Nepali university curricula.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.stat}
                    className="fade-in-up md:border-r md:border-outline-variant/30 md:px-8 md:last:border-r-0"
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <div className="mb-2 text-display-lg text-primary">{item.stat}</div>
                    <p className="text-body-md text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <HowItWorksSection />

          {/* Adaptive roadmap */}
          <section className="overflow-hidden bg-surface-bright py-section-gap">
            <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin-desktop">
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[3fr_2fr] lg:gap-14">
                <div className="fade-in-up order-2 lg:order-1">
                  <div className="overflow-hidden rounded-2xl border border-outline-variant ambient-shadow">
                    <Image
                      src={roadmapShot}
                      alt="DISHA AI roadmap — stage-by-stage skill path with locked, active, and completed nodes"
                      className="h-auto w-full"
                      sizes="(min-width: 1024px) 58vw, 100vw"
                    />
                  </div>
                </div>
                <div className="fade-in-up order-1 space-y-8 lg:order-2" style={{ transitionDelay: "120ms" }}>
                  <span className="text-label-sm uppercase tracking-widest text-primary">Adaptive roadmap</span>
                  <h2 className="text-headline-lg">
                    A fluid path for an ever-changing world.
                  </h2>
                  <p className="text-body-lg text-secondary">
                    Unlike static career advice, DISHA AI adapts as you learn.
                    Every course completed, every project finished, and every
                    skill unlocked updates your trajectory in real-time.
                  </p>
                  <ul className="space-y-6">
                    {[
                      {
                        title: "Dynamic Adjustments",
                        text: "Career paths that pivot as industry demands shift.",
                      },
                      {
                        title: "Milestone Verified",
                        text: "Earn micro-credentials that matter to real recruiters.",
                      },
                    ].map((item) => (
                      <li key={item.title} className="flex items-start gap-4">
                        <Icon name="check_circle" className="mt-1 text-primary" />
                        <div>
                          <h4 className="text-label-md font-bold">{item.title}</h4>
                          <p className="text-body-md text-secondary">{item.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Feature grid */}
          <section id="features" className="bg-surface-container-low py-section-gap">
            <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
              <div className="fade-in-up mb-16 space-y-4 text-center">
                <span className="text-label-sm uppercase tracking-widest text-primary">What&apos;s inside</span>
                <h2 className="text-headline-lg">
                  Precision tools for professional growth
                </h2>
                <p className="mx-auto max-w-xl text-body-md text-secondary">
                  Four modules that work together — from finding your gaps to landing
                  the interview.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature, i) => (
                  <div
                    key={feature.title}
                    className="card-hover group fade-in-up rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 transition-all duration-300 hover:border-primary/30"
                    style={{ transitionDelay: `${i * 90}ms` }}
                  >
                    <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                      <Icon name={feature.icon} size={22} />
                    </div>
                    <h4 className="mb-2 text-label-md font-bold text-on-surface">
                      {feature.title}
                    </h4>
                    <p className="text-label-sm leading-relaxed text-secondary">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <PricingSection />

          {/* Final CTA */}
          <section className="mx-auto max-w-container-max px-margin-mobile py-section-gap text-center md:px-margin-desktop">
            <div className="fade-in-up space-y-8 rounded-[32px] border border-outline-variant bg-surface-container-low p-16 md:p-20">
              <h2 className="mx-auto max-w-3xl text-display-lg-mobile leading-tight text-on-surface md:text-display-lg">
                Ready to define your own trajectory?
              </h2>
              <p className="mx-auto max-w-xl text-body-lg text-secondary">
                Join Nepali students and professionals navigating their future
                with DISHA AI.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <HeroCTA
                  className="group inline-flex items-center rounded-xl bg-primary px-10 py-5 text-label-md font-bold text-on-primary shadow-[0_12px_30px_-10px_rgba(0,80,203,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-[0_16px_36px_-10px_rgba(0,80,203,0.5)]"
                  startLabel="Let's start"
                  returningLabel="Go to Dashboard"
                  showArrow
                />
                <a
                  href="#features"
                  className="rounded-xl border border-outline-variant px-10 py-5 text-label-md text-on-surface transition-all duration-200 hover:border-primary/40 hover:bg-surface-container-lowest"
                >
                  See what&apos;s inside
                </a>
              </div>
              <p className="flex items-center justify-center gap-1.5 text-label-sm text-secondary">
                <Icon name="mail" size={16} className="text-primary" />
                Questions? Email us at{" "}
                <a href="mailto:contact@disha.ai" className="font-semibold text-primary hover:underline">
                  contact@disha.ai
                </a>
              </p>
            </div>
          </section>
        </main>
      </FadeInObserver>
      <MarketingFooter />
    </>
  );
}
