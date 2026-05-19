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
    btnClass: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
    features: [
      { text: "1 user seat", included: true },
      { text: "Up to 50 leads", included: true },
      { text: "Basic pipeline view", included: true },
      { text: "Email support", included: true },
      { text: "AI Assistant", included: false },
      { text: "SMS / Twilio", included: false },
      { text: "Automation rules", included: false },
      { text: "CSV import", included: false },
      { text: "Lead scraping", included: false },
      { text: "Underwriting AI Grader", included: false },
    ],
  },
  {
    id: "starter" as PlanId,
    name: "Starter",
    monthlyPrice: 39,
    yearlyPrice: 31,
    description: "Built for growing insurance teams ready to systematize.",
    icon: Zap,
    color: "border-[#557df5]/40",
    btnClass: "bg-[#557df5] text-white hover:bg-[#3a5fd9]",
    features: [
      { text: "3 user seats", included: true },
      { text: "Up to 500 leads", included: true },
      { text: "Full Kanban pipeline", included: true },
      { text: "CSV import", included: true },
      { text: "Basic automation (5 rules)", included: true },
      { text: "Email + chat support", included: true },
      { text: "AI Assistant", included: false },
      { text: "SMS / Twilio", included: false },
      { text: "Lead scraping", included: false },
      { text: "Underwriting AI Grader", included: false },
    ],
  },
  {
    id: "pro" as PlanId,
    name: "Pro",
    monthlyPrice: 99,
    yearlyPrice: 79,
    description: "The full operator stack. Everything your agency needs to dominate.",
    icon: Crown,
    color: "border-[#557df5]",
    popular: true,
    btnClass: "bg-gradient-to-r from-[#557df5] to-[#3a5fd9] text-white hover:brightness-110",
    features: [
      { text: "10 user seats", included: true },
      { text: "Unlimited leads", included: true },
      { text: "Full Kanban pipeline", included: true },
      { text: "CSV import", included: true },
      { text: "Full automation (unlimited)", included: true },
      { text: "AI Assistant (unlimited)", included: true },
      { text: "SMS via Twilio (BYOK)", included: true },
      { text: "AI lead scraping", included: true },
      { text: "Underwriting AI Grader", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: "enterprise" as PlanId,
    name: "Enterprise",
    monthlyPrice: 249,
    yearlyPrice: 199,
    description: "Custom scale for large agencies and regional carriers.",
    icon: Building2,
    color: "border-gray-200",
    btnClass: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
    features: [
      { text: "Unlimited seats", included: true },
      { text: "Everything in Pro", included: true },
      { text: "Custom onboarding", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee", included: true },
      { text: "API access (coming soon)", included: true },
      { text: "White-label options", included: true },
      { text: "Custom integrations", included: true },
      { text: "Invoice billing available", included: true },
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
  "Underwriting Grader",
  "Priority support",
];

const FEATURE_MAP: Record<PlanId, (string | false)[]> = {
  free:       ["1 seat", "50 leads", true, false, false, false, false, false, false, false],
  starter:    ["3 seats", "500 leads", true, true, "5 rules", false, false, false, false, false],
  pro:        ["10 seats", "Unlimited", true, true, "Unlimited", true, true, true, true, true],
  enterprise: ["Unlimited", "Unlimited", true, true, "Unlimited", true, true, true, true, true],
};

const FAQ = [
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Plan changes take effect at the start of your next billing cycle. Upgrades are prorated immediately.",
  },
  {
    q: "Is there a free trial?",
    a: "All paid plans include a 7-day free trial. No credit card required to start.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. Invoice billing is available on Enterprise plans.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, cancel at any time with no cancellation fees. Your access continues through the end of the billing period.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day money-back guarantee on all paid plans. Contact support within 7 days of your first charge.",
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
      const data = (await res.json()) as { url?: string | null; message?: string };
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(85,125,245,0.08),transparent_40%),linear-gradient(180deg,#f9f5eb_0%,#eef3fb_100%)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#557df5,#3a5fd9)] shadow-md">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-[#0f172a]">King CRM Hub</span>
        </div>
        <button
          onClick={() => router.push("/auth")}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#557df5]/40 px-4 text-sm font-medium text-[#557df5] transition hover:bg-[#557df5] hover:text-white"
        >
          Sign in <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-12 pt-12 text-center sm:px-10 sm:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#557df5]/30 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#557df5] shadow-sm backdrop-blur-sm">
          <Star className="h-3 w-3 fill-[#557df5]" />
          Transparent pricing. No surprises.
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-[#0f172a] sm:text-5xl">
          Plans built for{" "}
          <span className="bg-gradient-to-r from-[#557df5] to-[#3a5fd9] bg-clip-text text-transparent">
            insurance operators
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-[#475569] sm:text-lg">
          From solo producers to regional agencies — pick the tier that matches your operation and scale without limits.
        </p>

        {/* Toggle */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-sm backdrop-blur-sm">
          <button
            onClick={() => setInterval("monthly")}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              interval === "monthly" ? "bg-[#0f172a] text-white shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              interval === "yearly" ? "bg-[#0f172a] text-white shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Yearly
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
              interval === "yearly" ? "bg-emerald-400/30 text-emerald-200" : "bg-emerald-100 text-emerald-700"
            }`}>
              Save 20%
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
                  plan.popular ? "ring-2 ring-[#557df5]/30 shadow-[0_8px_32px_rgba(85,125,245,0.18)]" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#557df5] to-[#3a5fd9] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                      <Crown className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${plan.popular ? "bg-gradient-to-br from-[#557df5] to-[#3a5fd9]" : "bg-[#f1f5f9]"}`}>
                  <Icon className={`h-5 w-5 ${plan.popular ? "text-white" : "text-[#557df5]"}`} />
                </div>
                <h3 className="text-lg font-bold text-[#0f172a]">{plan.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{plan.description}</p>
                <div className="my-5">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-[#0f172a]">
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="mb-1 text-sm text-[#94a3b8]">/mo</span>
                    )}
                  </div>
                  {price === 0 && (
                    <span className="text-sm text-[#94a3b8]">Free forever</span>
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
                    "Contact sales"
                  ) : (
                    <>Start 7-day trial <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </button>
                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-[#cbd5e1]" />
                      )}
                      <span className={f.included ? "text-[#1e293b]" : "text-[#94a3b8]"}>{f.text}</span>
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
        <h2 className="mb-8 text-center text-2xl font-bold text-[#0f172a]">Full feature comparison</h2>
        <div className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="py-4 pl-6 text-left font-semibold text-[#64748b]">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`py-4 text-center font-bold ${p.popular ? "text-[#557df5]" : "text-[#0f172a]"}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FEATURES.map((feature, i) => (
                <tr key={feature} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                  <td className="py-3.5 pl-6 text-[#1e293b]">{feature}</td>
                  {(["free", "starter", "pro", "enterprise"] as PlanId[]).map((planId) => {
                    const val = FEATURE_MAP[planId][i];
                    return (
                      <td key={planId} className="py-3.5 text-center">
                        {val === true ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : val === false ? (
                          <X className="mx-auto h-4 w-4 text-[#cbd5e1]" />
                        ) : (
                          <span className="text-xs font-medium text-[#475569]">{val}</span>
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

      {/* Testimonials */}
      <section className="bg-[#0f172a] px-6 py-16 sm:px-10">
        <h2 className="mb-10 text-center text-2xl font-bold text-white">What operators are saying</h2>
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
          {[
            { name: "Marcus T.", role: "Independent Producer, TX", quote: "Went from juggling spreadsheets to having a real system in one afternoon. The pipeline alone is worth it." },
            { name: "Dena R.", role: "Agency Owner, FL", quote: "The AI assistant is legitimately useful. It knows insurance ops, not just generic CRM fluff." },
            { name: "James P.", role: "Sales Manager, GA", quote: "CSV import + lead scraping cut our prospecting time by 60%. The team finally has a real workflow." },
          ].map((t) => (
            <div key={t.name} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#557df5] text-[#557df5]" />
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-white/75">&ldquo;{t.quote}&rdquo;</p>
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-white/50">{t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10">
        <h2 className="mb-8 text-center text-2xl font-bold text-[#0f172a]">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#0f172a] hover:bg-[#f8fafc]"
              >
                {item.q}
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748b] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="border-t border-[#e2e8f0] px-6 py-4 text-sm leading-relaxed text-[#475569]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-br from-[#557df5] to-[#3a5fd9] px-6 py-16 text-center sm:px-10">
        <h2 className="text-3xl font-bold text-white">Ready to run a tighter operation?</h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/80">
          Start free. Upgrade when you&apos;re ready. No long-term contracts.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/auth")}
            className="flex h-12 items-center gap-2 rounded-2xl bg-white px-8 text-sm font-bold text-[#557df5] shadow-lg transition hover:shadow-xl"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleCta("pro")}
            className="flex h-12 items-center gap-2 rounded-2xl border border-white/40 px-8 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Try Pro free for 7 days
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] py-8 text-center text-xs text-[#94a3b8]">
        © {new Date().getFullYear()} King CRM Hub. All rights reserved.
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-[#e2e8f0] bg-white px-6 py-3.5 text-sm font-medium text-[#0f172a] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
