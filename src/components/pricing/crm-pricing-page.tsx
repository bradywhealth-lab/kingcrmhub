"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, Zap, Crown, Building2, Users, Shield, ChevronDown,
  Loader2, Star, ArrowRight,
} from "lucide-react";

type Interval = "monthly" | "yearly";
type PlanId = "free" | "starter" | "pro" | "enterprise";

const PLANS = [
  {
    id: "free" as PlanId,
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Get started with the basics. No credit card required.",
    icon: Shield,
    color: "border-gray-200",
    btnClass: "bg-[#0c111b] text-white hover:bg-[#14202e]",
    features: [
      { text: "1 user seat", included: true },
      { text: "Up to 50 leads", included: true },
      { text: "Basic pipeline view", included: true },
      { text: "Email support", included: true },
      { text: "AI Assistant (limited)", included: true },
      { text: "SMS / Twilio", included: false },
      { text: "Basic automation (3 rules)", included: true },
      { text: "CSV import", included: false },
      { text: "Lead scraping", included: false },
      { text: "AI lead prioritization", included: false },
    ],
  },
  {
    id: "starter" as PlanId,
    name: "Pro",
    monthlyPrice: 19,
    yearlyPrice: 16,
    description: "For freelancers ready to systematize client work and follow-up.",
    icon: Zap,
    color: "border-[#127c66]/40",
    btnClass: "bg-[#18b897] text-[#0c111b] hover:bg-[#15a88a]",
    features: [
      { text: "1 user seat", included: true },
      { text: "Up to 500 leads", included: true },
      { text: "Full Kanban pipeline", included: true },
      { text: "CSV import", included: true },
      { text: "Basic automation (5 rules)", included: true },
      { text: "Email + chat support", included: true },
      { text: "AI Assistant", included: true },
      { text: "SMS / Twilio", included: false },
      { text: "Lead scraping", included: false },
      { text: "AI lead prioritization", included: false },
    ],
  },
  {
    id: "pro" as PlanId,
    name: "Studio",
    monthlyPrice: 39,
    yearlyPrice: 32,
    description: "The complete client operations stack for established solo businesses.",
    icon: Crown,
    color: "border-[#127c66]",
    popular: true,
    btnClass: "bg-[#18b897] text-[#0c111b] hover:bg-[#15a88a]",
    features: [
      { text: "3 user seats", included: true },
      { text: "Unlimited leads", included: true },
      { text: "Full Kanban pipeline", included: true },
      { text: "CSV import", included: true },
      { text: "Full automation (unlimited)", included: true },
      { text: "AI Assistant (unlimited)", included: true },
      { text: "SMS via Twilio (BYOK)", included: true },
      { text: "AI lead scraping", included: true },
      { text: "AI lead prioritization", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: "enterprise" as PlanId,
    name: "Elite",
    monthlyPrice: 69,
    yearlyPrice: 57,
    description: "Advanced scale, support, and customization for growing studios.",
    icon: Building2,
    color: "border-gray-200",
    btnClass: "bg-[#0c111b] text-white hover:bg-[#14202e]",
    features: [
      { text: "Unlimited seats", included: true },
      { text: "Everything in Studio", included: true },
      { text: "Custom onboarding", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Priority service agreement", included: true },
      { text: "API access (planned)", included: false },
      { text: "White-label options (planned)", included: false },
      { text: "Custom integrations (planned)", included: false },
      { text: "Flexible billing options (planned)", included: false },
      { text: "Security review", included: true },
    ],
  },
];

const COMPARE_FEATURES = [
  "User seats",
  "Leads",
  "Pipeline (Kanban)",
  "CSV import",
  "Automation rules",
  "AI Assistant",
  "SMS / Twilio",
  "Lead scraping",
  "AI lead prioritization",
  "Priority support",
];

const FEATURE_MAP: Record<PlanId, (string | boolean)[]> = {
  free:   ["1 seat", "50 leads", true, false, false, false, false, false, false, false],
  starter:    ["1 seat", "500 leads", true, true, "5 rules", false, false, false, false, false],
  pro:        ["3 seats", "Unlimited", true, true, "Unlimited", true, true, true, true, true],
  enterprise: ["Unlimited", "Unlimited", true, true, "Unlimited", true, true, true, true, true],
};

const FAQ = [
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Paid upgrades are not active yet. We will show the exact billing terms before taking any payment.",
  },
  {
    q: "Can I use King CRM Hub now?",
    a: "Yes. Create a free workspace now; paid upgrades will open after billing is fully verified.",
  },
  {
    q: "What happens when I choose a paid plan?",
    a: "Sign in or create a workspace and we will show an availability notice. You will not be charged while billing is offline.",
  },
  {
    q: "Will my free workspace keep working?",
    a: "Yes. The free plan remains available while paid billing is being prepared.",
  },
  {
    q: "When will billing terms be available?",
    a: "Before paid checkout launches. Pricing, cancellation, and support terms will be published before any charge can occur.",
  },
];

export function CrmPricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleCta = async (planId: PlanId) => {
    if (planId === "free") {
      router.push("/auth");
      return;
    }
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const data = (await res.json()) as { url?: string | null; message?: string; error?: string };
      if (res.status === 401) {
        router.push(`/auth?callbackUrl=${encodeURIComponent(`/pricing?plan=${planId}&interval=${interval}`)}`);
        return;
      }
      if (!res.ok) {
        showToast(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.message ?? "Payments launching soon — stay tuned!");
      }
    } catch {
      showToast("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(24,184,151,0.08),transparent_40%),linear-gradient(180deg,#fcf8ec_0%,#f4f0e6_100%)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--teal)] shadow-md">
            <Shield className="h-4 w-4 text-[var(--ink)]" />
          </div>
          <span className="text-base font-bold tracking-tight text-[#0c111b]">King CRM Hub</span>
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#127c66]/40 px-4 text-sm font-medium text-[#127c66] transition hover:bg-[#18b897] hover:text-[#0c111b]"
        >
          Sign in <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-12 pt-12 text-center sm:px-10 sm:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#127c66]/30 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#127c66] shadow-sm backdrop-blur-sm">
          <Star className="h-3 w-3 fill-[#18b897]" />
          Paid-plan preview. Billing is not active yet.
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-[#0c111b] sm:text-5xl">
          Plans built for{" "}
          <span className="text-[#127c66]">
            independent client work
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-[#545961] sm:text-lg">
          Start free, then choose the tier that matches your freelance business as it grows.
        </p>

        {/* Toggle */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-sm backdrop-blur-sm">
          <button
            onClick={() => setInterval("monthly")}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              interval === "monthly" ? "bg-[#0c111b] text-white shadow-sm" : "text-[#545961] hover:text-[#0c111b]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              interval === "yearly" ? "bg-[#0c111b] text-white shadow-sm" : "text-[#545961] hover:text-[#0c111b]"
            }`}
          >
            Yearly
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
              interval === "yearly" ? "bg-emerald-400/30 text-emerald-200" : "bg-emerald-100 text-emerald-700"
            }`}>
              Save up to 18%
            </span>
          </button>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const isLoading = loadingPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border-2 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${plan.color} ${
                  plan.popular ? "ring-2 ring-[#18b897]/30 shadow-[0_8px_32px_rgba(24,184,151,0.18)]" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 rounded-full bg-[#18b897] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink)] shadow-md">
                      <Crown className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${plan.popular ? "bg-[#18b897]" : "bg-[#f4f0e6]"}`}>
                  <Icon className={`h-5 w-5 ${plan.popular ? "text-[var(--ink)]" : "text-[#127c66]"}`} />
                </div>
                <h3 className="text-lg font-bold text-[#0c111b]">{plan.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#545961]">{plan.description}</p>
                <div className="my-5">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-[#0c111b]">
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="mb-1 text-sm text-[#6b6e74]">/mo</span>
                    )}
                  </div>
                  {price === 0 && (
                    <span className="text-sm text-[#6b6e74]">Free forever</span>
                  )}
                  {interval === "yearly" && price > 0 && (
                    <p className="mt-1 text-xs text-emerald-600">Billed ${price * 12}/year</p>
                  )}
                </div>
                <button
                  onClick={() => void handleCta(plan.id)}
                  disabled={isLoading}
                  className={`mb-6 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${plan.btnClass}`}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                  ) : plan.id === "free" ? (
                    "Get started free"
                  ) : plan.id === "enterprise" ? (
                    "Get Elite access"
                  ) : (
                    <>Get early access <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </button>
                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-[#d6d0c2]" />
                      )}
                      <span className={f.included ? "text-[#0c111b]" : "text-[#6b6e74]"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <h2 className="mb-8 text-center text-2xl font-bold text-[#0c111b]">Full feature comparison</h2>
        <div className="overflow-hidden rounded-3xl border border-[var(--ink-line)] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ink-line)] bg-[#f4f0e6]">
                <th className="py-4 pl-6 text-left font-semibold text-[#545961]">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`py-4 text-center font-bold ${p.popular ? "text-[#127c66]" : "text-[#0c111b]"}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FEATURES.map((feature, i) => (
                <tr key={feature} className={i % 2 === 0 ? "bg-white" : "bg-[#f4f0e6]"}>
                  <td className="py-3.5 pl-6 text-[#0c111b]">{feature}</td>
                  {(["free", "starter", "pro", "enterprise"] as PlanId[]).map((planId) => {
                    const val = FEATURE_MAP[planId][i];
                    return (
                      <td key={planId} className="py-3.5 text-center">
                        {val === true ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : val === false ? (
                          <X className="mx-auto h-4 w-4 text-[#d6d0c2]" />
                        ) : (
                          <span className="text-xs font-medium text-[#545961]">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Honest launch status — never fabricate customer proof or active billing. */}
      <section className="bg-[#0c111b] px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white">Use the free workspace now</h2>
          <p className="mt-3 text-base leading-7 text-white/75">
            The paid ladder is a preview. Checkout stays disabled until billing, entitlements, and cancellation terms are fully verified.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10">
        <h2 className="mb-8 text-center text-2xl font-bold text-[#0c111b]">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-[var(--ink-line)] bg-white">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#0c111b] hover:bg-[#f4f0e6]"
              >
                {item.q}
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#545961] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="border-t border-[var(--ink-line)] px-6 py-4 text-sm leading-relaxed text-[#545961]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#18b897] px-6 py-16 text-center sm:px-10">
        <h2 className="text-3xl font-bold text-[#0c111b]">Ready to run a tighter operation?</h2>
        <p className="mx-auto mt-3 max-w-md text-base text-[#0c111b]/80">
          Start free today. Paid options will open only after the full billing flow is verified.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/auth")}
            className="flex h-12 items-center gap-2 rounded-2xl bg-white px-8 text-sm font-bold text-[#127c66] shadow-lg transition hover:shadow-xl"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleCta("pro")}
            className="flex h-12 items-center gap-2 rounded-2xl border border-[#0c111b]/40 px-8 text-sm font-semibold text-[#0c111b] transition hover:bg-[#0c111b]/10"
          >
            Preview Studio plan
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--ink-line)] py-8 text-center text-xs text-[#6b6e74]">
        © {new Date().getFullYear()} King CRM Hub. Proof. Decision. Next Move.
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-[var(--ink-line)] bg-white px-6 py-3.5 text-sm font-medium text-[#0c111b] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
