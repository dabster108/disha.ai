import HeroCTA from "@/components/layout/HeroCTA";
import Icon from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    icon: "person",
    price: "NPR 0",
    cadence: "forever",
    description: "Everything a student needs to find direction.",
    features: [
      "Full skill gap analysis",
      "AI-generated career roadmap",
      "Skill practice challenges",
      "Leaderboard access",
    ],
    cta: "free",
  },
  {
    name: "Pro",
    icon: "workspace_premium",
    price: "Coming soon",
    cadence: null,
    description: "For students ready to interview and apply.",
    features: [
      "Everything in Free",
      "AI mock interview & scoring",
      "Live job matching",
      "Advanced skill analytics",
    ],
    highlighted: true,
    badge: "Most popular",
    cta: "soon",
  },
  {
    name: "College",
    icon: "apartment",
    price: "Custom",
    cadence: null,
    description: "For universities and bootcamps.",
    features: [
      "Everything in Pro",
      "Bulk student seats",
      "Faculty cohort dashboard",
      "Dedicated onboarding",
    ],
    cta: "soon",
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-container-max px-margin-mobile py-section-gap md:px-margin-desktop">
      <div className="fade-in-up mb-16 space-y-4 text-center">
        <span className="text-label-sm uppercase tracking-widest text-primary">Pricing</span>
        <h2 className="text-headline-lg">Start free. Grow when you&apos;re ready.</h2>
        <p className="mx-auto max-w-xl text-body-md text-secondary">
          Every student starts on Free, no card required. Pro and College plans are on the way.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {plans.map((plan, i) => (
          <div
            key={plan.name}
            style={{ transitionDelay: `${i * 100}ms` }}
            className={cn(
              "fade-in-up relative flex flex-col rounded-2xl border p-8 transition-all duration-300",
              plan.highlighted
                ? "border-primary bg-surface-container-lowest shadow-[0_25px_60px_-25px_rgba(0,80,203,0.35)]"
                : "card-hover border-outline-variant bg-surface-container-lowest hover:border-primary/30"
            )}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-label-sm font-bold text-on-primary shadow-sm">
                {plan.badge}
              </span>
            )}

            <div
              className={cn(
                "mb-6 flex h-11 w-11 items-center justify-center rounded-lg",
                plan.highlighted ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"
              )}
            >
              <Icon name={plan.icon} size={22} />
            </div>

            <h3 className="text-headline-md font-bold text-on-surface">{plan.name}</h3>
            <p className="mt-1 text-sm text-secondary">{plan.description}</p>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-headline-lg font-bold text-on-surface">{plan.price}</span>
              {plan.cadence && <span className="text-sm text-secondary">/ {plan.cadence}</span>}
            </div>

            <ul className="mt-8 flex-1 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-on-surface">
                  <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-primary" filled />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {plan.cta === "free" ? (
                <HeroCTA
                  className="group flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-label-md font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-md"
                  startLabel="Start Free"
                  returningLabel="Go to Dashboard"
                  showArrow
                />
              ) : (
                <span
                  aria-disabled="true"
                  className="flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-outline-variant px-6 py-3 text-label-md font-semibold text-secondary"
                >
                  Coming soon
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
