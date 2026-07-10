import Image from "next/image";
import Link from "next/link";
import MarketingFooter from "@/components/layout/MarketingFooter";
import MarketingHeader from "@/components/layout/MarketingHeader";
import HeroCTA from "@/components/layout/HeroCTA";
import FadeInObserver from "@/components/ui/FadeInObserver";
import Icon from "@/components/ui/Icon";

const institutions = [
  "KATHMANDU UNIVERSITY",
  "TRIBHUVAN UNI",
  "NCELL",
  "DEERWALK",
  "LEAPFROG",
];

const steps = [
  {
    icon: "explore",
    title: "Discover",
    description:
      "Advanced psychometric AI profiling to understand your core strengths and latent potential.",
  },
  {
    icon: "auto_stories",
    title: "Learn",
    description:
      "Personalized curriculum paths that bridge your current skills with industry requirements.",
  },
  {
    icon: "work",
    title: "Get Hired",
    description:
      "Direct pipelines to top employers in Nepal and abroad who value your verified skills.",
  },
];

const features = [
  {
    title: "Personalized Assessment",
    description: "Deep psychological and technical profiling.",
    imageStyle: { objectPosition: "0% 0%", width: "100px" },
  },
  {
    title: "Skill Mapping",
    description: "Visualize where you stand against global benchmarks.",
    imageStyle: {
      objectPosition: "100% 0%",
      transform: "translateX(-50%)",
      width: "300px",
    },
    wrapperStyle: { width: "100px", height: "96px", overflow: "hidden" },
  },
  {
    title: "Direct Hiring",
    description: "Direct matchmaking with verified partner companies.",
    imageStyle: {
      objectPosition: "0% 100%",
      transform: "translateY(-50%)",
      width: "200px",
    },
    wrapperStyle: { width: "100px", height: "96px", overflow: "hidden" },
  },
  {
    title: "Growth Tracking",
    description: "Monitor your progress with detailed analytics.",
    imageStyle: {
      objectPosition: "100% 100%",
      transform: "translate(-50%, -50%)",
      width: "200px",
    },
    wrapperStyle: { width: "100px", height: "96px", overflow: "hidden" },
  },
];

const featureSprite =
  "https://lh3.googleusercontent.com/aida/AP1WRLtZUtJUT_9-ymYQQ2DY0nHCHMK89LinJSLkrhNVvetVnMz0JWrCjvO3tsAeGDfG3Ujz2Kl9V1Ci0imqyKdRL33yzv7Fgb1AWbh8jMRzz0hh1K088y7lSHWvCg9EEnAeM4iRvHdyWlo56D5MCjO-rmFlJ47CRDb0XmaHbQwk_zdsly-1NhfWxougC4FnSgcWQKPXDAFdEjHOXwwuL4silifeL0MMxrOvVJIFKs9hZy9fR-wf0SyqNUCNwI0T";

export default function Home() {
  return (
    <>
      <MarketingHeader />
      <FadeInObserver>
        <main className="pt-[72px]">
          <section className="mx-auto flex min-h-[90vh] max-w-container-max items-center overflow-hidden px-margin-mobile py-20 md:px-margin-desktop">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div className="space-y-10">
                <div className="overflow-hidden">
                  <h1 className="mask-reveal text-display-lg leading-tight md:text-display-lg">
                    Your future isn&apos;t uncertain. It just needs{" "}
                    <span className="text-primary">direction.</span>
                  </h1>
                </div>
                <p className="fade-in-up max-w-lg text-body-lg text-secondary">
                  Nepal&apos;s first AI-powered career navigator designed to bridge
                  the gap between education and global career standards.
                </p>
                <div className="fade-in-up flex flex-wrap gap-6">
                  <HeroCTA
                    className="rounded-xl bg-primary px-8 py-4 text-label-md text-on-primary shadow-lg shadow-primary/10 transition-all hover:bg-on-primary-fixed-variant"
                    startLabel="Start My Roadmap"
                    returningLabel="Go to Dashboard"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-outline-variant px-8 py-4 text-label-md text-on-surface transition-all hover:bg-surface-container"
                  >
                    View Success Stories
                  </button>
                </div>
              </div>
              <div className="fade-in-up relative">
                <Image
                  className="h-auto w-full"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLv-MU4joDibclvOkr_cNV9qZJbYkftlN68OGesA-IVEJ71-k_tgwehTYK4dd30drlaDZdGy98E2ngSED6ZxRPa4moFIoPuJzJnX_XZK81Kg5a5URRujLixUnYXyeyO6DR-d5AztF3Z6LQXe9JvL6pF0LiNdi7K3-lvmlxVQI8nW_GoltV9tkxzJF8Y7KioibRwW2R0DqkAojim5aPStkZezDhQg41FXOgvD2xQGu384JPLTmvsaga1IQ_Y"
                  alt="Educational and career paths illustration"
                  width={600}
                  height={500}
                  priority
                />
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low py-section-gap">
            <div className="mx-auto max-w-container-max space-y-20 px-margin-mobile text-center md:px-margin-desktop">
              <div className="mx-auto max-w-2xl space-y-6">
                <span className="text-label-sm uppercase tracking-widest text-primary">
                  The Education Gap
                </span>
                <h2 className="text-headline-lg">
                  Bridging the disconnect in Nepal&apos;s talent ecosystem.
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
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
                    className="fade-in-up border-r border-outline-variant/30 p-8 last:border-r-0"
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <div className="mb-2 text-display-lg text-primary">
                      {item.stat}
                    </div>
                    <p className="text-body-md text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-container-max px-margin-mobile py-section-gap md:px-margin-desktop">
            <div className="mb-24 flex flex-col items-end justify-between gap-8 md:flex-row">
              <div className="max-w-xl space-y-4">
                <h2 className="text-headline-lg">
                  Your journey to mastery, simplified into three core stages.
                </h2>
              </div>
              <p className="max-w-sm text-body-md text-secondary">
                We take the guesswork out of professional growth by providing a
                clear, actionable path forward.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.title}
                  className="group rounded-xl border border-outline-variant bg-white p-10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon name={step.icon} />
                  </div>
                  <h3 className="mb-4 text-headline-md">{step.title}</h3>
                  <p className="text-body-md text-secondary">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden bg-surface-bright py-section-gap">
            <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
              <div className="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">
                <div className="fade-in-up order-2 lg:order-1">
                  <Image
                    className="w-full rounded-2xl ambient-shadow"
                    src="https://lh3.googleusercontent.com/aida/AP1WRLtTfh01JyJbEixM5aj6NFOYSuRBnaTBtQXMQkcZKrC9LfhPA3QIu7xL5Vcmk34RVKqRnOltQqMj4GWaYK6QG6Y-SS8vz8ZLjqsQ6O9dAcWQohgC_H1E-Rmz0SSW6BPrIukwVPzEGjowRqaBkW4frKHmbGs4YvVHRF6qINmJkgaPGIVQtCrsTOV2pQ9dK1MoCklVlan-8otdcZuvzDisJWZmqjNe6K0zaje7YFxFAj2wr9KF3PRFMwgvmEs"
                    alt="AI career pathways illustration"
                    width={600}
                    height={400}
                  />
                </div>
                <div className="order-1 space-y-8 lg:order-2">
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

          <section className="mx-auto max-w-container-max px-margin-mobile py-section-gap md:px-margin-desktop">
            <div className="mb-20 space-y-4 text-center">
              <h2 className="text-headline-lg">
                Precision tools for professional growth
              </h2>
              <p className="mx-auto max-w-xl text-body-md text-secondary">
                Our specialized modules provide the deep insights necessary for
                navigating high-stakes career decisions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group flex flex-col items-center rounded-xl border border-outline-variant bg-white p-8 text-center transition-all duration-300 hover:bg-surface-container-low"
                >
                  <div
                    className="mb-6 opacity-80 transition-opacity group-hover:opacity-100"
                    style={feature.wrapperStyle}
                  >
                    <Image
                      className="h-24 w-auto object-contain"
                      src={featureSprite}
                      alt={feature.title}
                      width={100}
                      height={96}
                      style={feature.imageStyle}
                    />
                  </div>
                  <h4 className="mb-3 text-label-md font-bold uppercase tracking-wider">
                    {feature.title}
                  </h4>
                  <p className="text-label-sm text-secondary">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden border-y border-outline-variant/30 py-24">
            <div className="mx-auto flex max-w-container-max flex-col items-center gap-12 px-margin-mobile md:px-margin-desktop">
              <span className="relative z-10 text-label-sm uppercase tracking-[0.2em] text-secondary">
                Trusted by Nepal&apos;s Leading Institutions
              </span>
              <div className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]">
                <div className="animate-marquee flex whitespace-nowrap py-4">
                  {[...institutions, ...institutions].map((name, i) => (
                    <div
                      key={`${name}-${i}`}
                      className="px-10 text-headline-md font-bold text-on-surface/40 transition-colors hover:text-on-surface"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-container-max px-margin-mobile py-section-gap text-center md:px-margin-desktop">
            <div className="relative space-y-10 overflow-hidden rounded-[32px] border border-outline-variant bg-white p-16 ambient-shadow md:p-24">
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-fixed via-transparent to-transparent" />
              </div>
              <h2 className="relative z-10 mx-auto max-w-3xl text-display-lg-mobile leading-tight text-on-surface md:text-display-lg">
                Ready to define your own trajectory?
              </h2>
              <p className="relative z-10 mx-auto max-w-xl text-body-lg text-secondary">
                Join over 50,000 Nepali students and professionals navigating
                their future with DISHA AI.
              </p>
              <div className="relative z-10 flex flex-wrap justify-center gap-6">
                <HeroCTA
                  className="rounded-xl bg-primary px-10 py-5 text-label-md font-bold text-on-primary transition-all hover:scale-[1.02] hover:bg-primary-container"
                  startLabel="Create Free Profile"
                  returningLabel="Go to Dashboard"
                />
                <button
                  type="button"
                  className="rounded-xl border border-outline-variant px-10 py-5 text-label-md text-on-surface transition-all hover:bg-surface-container-low"
                >
                  Talk to an Advisor
                </button>
              </div>
            </div>
          </section>
        </main>
      </FadeInObserver>
      <MarketingFooter />
    </>
  );
}
