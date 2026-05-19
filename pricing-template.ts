// ============================================================
// KingCRMHub Pricing Template — ready to wire up
// Created: 2026-04-29
// Status: TEMPLATE ONLY — not yet connected to Stripe or DB
// ============================================================
// To implement: wire PLANS into:
//   1. /src/app/pricing/page.tsx (display)
//   2. /src/lib/plans.ts (feature gating)
//   3. Stripe products/prices (billing)
//   4. Middleware or API route (enforcement)
// ============================================================

export type PlanId = "free" | "starter" | "growth" | "pro" | "agency";

export type Plan = {
  id: PlanId;
  name: string;
  price: number; // USD/month
  annualPrice: number; // USD/month billed annually (20% off)
  stripeMonthlyPriceId: string; // TODO: fill in after creating Stripe products
  stripeAnnualPriceId: string;  // TODO: fill in after creating Stripe products
  highlighted: boolean; // show as "most popular"
  limits: {
    leads: number | null;         // null = unlimited
    smsPerMonth: number | null;   // null = unlimited
    aiQueriesPerMonth: number | null; // null = unlimited
    emailCampaignsPerMonth: number | null;
    pipelines: number | null;
    teamSeats: number | null;
    automationWorkflows: number | null;
  };
  features: {
    // Core CRM
    contactManagement: boolean;
    pipeline: boolean;
    tasks: boolean;
    notes: boolean;
    // Communication
    emailIntegration: boolean;
    smsAutomation: boolean;
    // AI
    aiAssistant: boolean;
    aiLeadScoring: boolean;      // AI scores each lead 1-10
    aiEmailSuggestions: boolean; // AI drafts email replies
    // Marketing
    campaigns: boolean;
    analytics: boolean;
    // Advanced
    customFields: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
  };
  badge?: string; // e.g. "Most Popular"
  description: string;
};

// ============================================================
// OPTION A — 4-Tier Classic (RECOMMENDED)
// Best matches user's 9.99/9.99 requirement
// Clean upgrade path matching ActiveCampaign/HubSpot structure
// ============================================================
export const PLANS_OPTION_A: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19.99,
    annualPrice: 15.99,
    stripeMonthlyPriceId: "price_TODO_starter_monthly",
    stripeAnnualPriceId: "price_TODO_starter_annual",
    highlighted: false,
    limits: {
      leads: 10_000,
      smsPerMonth: 500,
      aiQueriesPerMonth: 50,
      emailCampaignsPerMonth: 5,
      pipelines: 1,
      teamSeats: 1,
      automationWorkflows: 5,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,       // limited to 500/mo
      aiAssistant: true,         // limited to 50 queries/mo
      aiLeadScoring: false,
      aiEmailSuggestions: false,
      campaigns: false,
      analytics: true,           // basic only
      customFields: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedSupport: false,
    },
    description: "Perfect for solopreneurs managing their first pipeline.",
  },
  {
    id: "growth",
    name: "Growth",
    price: 49.99,
    annualPrice: 39.99,
    stripeMonthlyPriceId: "price_TODO_growth_monthly",
    stripeAnnualPriceId: "price_TODO_growth_annual",
    highlighted: true,
    badge: "Most Popular",
    limits: {
      leads: 50_000,
      smsPerMonth: 2_500,
      aiQueriesPerMonth: 300,
      emailCampaignsPerMonth: 30,
      pipelines: 5,
      teamSeats: 3,
      automationWorkflows: 25,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: true,
      aiEmailSuggestions: true,
      campaigns: true,
      analytics: true,           // full analytics
      customFields: true,
      apiAccess: false,
      whiteLabel: false,
      dedicatedSupport: false,
    },
    description: "For growing small businesses ready to automate.",
  },
  {
    id: "pro",
    name: "Pro",
    price: 99.00,
    annualPrice: 79.00,
    stripeMonthlyPriceId: "price_TODO_pro_monthly",
    stripeAnnualPriceId: "price_TODO_pro_annual",
    highlighted: false,
    limits: {
      leads: 100_000,
      smsPerMonth: 10_000,
      aiQueriesPerMonth: 1_500,
      emailCampaignsPerMonth: null, // unlimited
      pipelines: null,              // unlimited
      teamSeats: 10,
      automationWorkflows: null,    // unlimited
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: true,
      aiEmailSuggestions: true,
      campaigns: true,
      analytics: true,
      customFields: true,
      apiAccess: true,
      whiteLabel: false,
      dedicatedSupport: false,
    },
    description: "Scale to six figures with advanced AI and automation.",
  },
  {
    id: "agency",
    name: "Agency",
    price: 249.00,
    annualPrice: 199.00,
    stripeMonthlyPriceId: "price_TODO_agency_monthly",
    stripeAnnualPriceId: "price_TODO_agency_annual",
    highlighted: false,
    limits: {
      leads: null,        // unlimited
      smsPerMonth: null,  // unlimited
      aiQueriesPerMonth: null,
      emailCampaignsPerMonth: null,
      pipelines: null,
      teamSeats: null,
      automationWorkflows: null,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: true,
      aiEmailSuggestions: true,
      campaigns: true,
      analytics: true,
      customFields: true,
      apiAccess: true,
      whiteLabel: true,
      dedicatedSupport: true,
    },
    description: "Unlimited everything. Built for agencies running multiple clients.",
  },
];

// ============================================================
// OPTION B — 3-Tier Aggressive (Simpler / lower entry barrier)
// Pros: easier to explain, fewer decision points
// Cons: large jump from 9.99 to 49 — skips 100K tier
// ============================================================
export const PLANS_OPTION_B: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19.99,
    annualPrice: 15.99,
    stripeMonthlyPriceId: "price_TODO_starter_monthly",
    stripeAnnualPriceId: "price_TODO_starter_annual",
    highlighted: false,
    limits: {
      leads: 10_000,
      smsPerMonth: 250,
      aiQueriesPerMonth: 30,
      emailCampaignsPerMonth: 3,
      pipelines: 1,
      teamSeats: 1,
      automationWorkflows: 3,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: false,
      aiEmailSuggestions: false,
      campaigns: false,
      analytics: true,
      customFields: false,
      apiAccess: false,
      whiteLabel: false,
      dedicatedSupport: false,
    },
    description: "Get started fast with the essentials.",
  },
  {
    id: "growth",
    name: "Plus",
    price: 49.99,
    annualPrice: 39.99,
    stripeMonthlyPriceId: "price_TODO_plus_monthly",
    stripeAnnualPriceId: "price_TODO_plus_annual",
    highlighted: true,
    badge: "Best Value",
    limits: {
      leads: 50_000,
      smsPerMonth: 5_000,
      aiQueriesPerMonth: 500,
      emailCampaignsPerMonth: null,
      pipelines: null,
      teamSeats: 5,
      automationWorkflows: null,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: true,
      aiEmailSuggestions: true,
      campaigns: true,
      analytics: true,
      customFields: true,
      apiAccess: false,
      whiteLabel: false,
      dedicatedSupport: false,
    },
    description: "Everything you need to grow a serious business.",
  },
  {
    id: "agency",
    name: "Agency",
    price: 149.00,
    annualPrice: 119.00,
    stripeMonthlyPriceId: "price_TODO_agency_monthly",
    stripeAnnualPriceId: "price_TODO_agency_annual",
    highlighted: false,
    limits: {
      leads: null,
      smsPerMonth: null,
      aiQueriesPerMonth: null,
      emailCampaignsPerMonth: null,
      pipelines: null,
      teamSeats: null,
      automationWorkflows: null,
    },
    features: {
      contactManagement: true,
      pipeline: true,
      tasks: true,
      notes: true,
      emailIntegration: true,
      smsAutomation: true,
      aiAssistant: true,
      aiLeadScoring: true,
      aiEmailSuggestions: true,
      campaigns: true,
      analytics: true,
      customFields: true,
      apiAccess: true,
      whiteLabel: true,
      dedicatedSupport: true,
    },
    description: "Unlimited power for agencies and high-volume operations.",
  },
];

// ============================================================
// ACTIVE PLAN SET — swap this to switch which option is live
// ============================================================
export const PLANS = PLANS_OPTION_A;

// ============================================================
// HELPER: check if a feature is allowed for a given plan
// Usage: canUse("aiAssistant", userPlan)
// ============================================================
export function canUse(feature: keyof Plan["features"], planId: PlanId): boolean {
  if (planId === "free") return FREE_PLAN.features[feature];
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return false;
  return plan.features[feature];
}

// ============================================================
// HELPER: get limit for a given plan
// Returns null if unlimited, 0 if plan not found
// Handles both paid tiers (PLANS) and the free tier (FREE_PLAN)
// ============================================================
export function getLimit(limit: keyof Plan["limits"], planId: PlanId): number | null {
  if (planId === "free") return FREE_PLAN.limits[limit];
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return 0;
  return plan.limits[limit];
}

// ============================================================
// FREE PLAN (no payment needed — used before user subscribes)
// ============================================================
export const FREE_PLAN: Plan = {
  id: "free",
  name: "Free",
  price: 0,
  annualPrice: 0,
  stripeMonthlyPriceId: "",
  stripeAnnualPriceId: "",
  highlighted: false,
  limits: {
    leads: 500,
    smsPerMonth: 0,
    aiQueriesPerMonth: 5,
    emailCampaignsPerMonth: 0,
    pipelines: 1,
    teamSeats: 1,
    automationWorkflows: 0,
  },
  features: {
    contactManagement: true,
    pipeline: true,
    tasks: true,
    notes: true,
    emailIntegration: false,
    smsAutomation: false,
    aiAssistant: true,          // 5 queries only
    aiLeadScoring: false,
    aiEmailSuggestions: false,
    campaigns: false,
    analytics: false,
    customFields: false,
    apiAccess: false,
    whiteLabel: false,
    dedicatedSupport: false,
  },
  description: "Try KingCRM free — no credit card required.",
};
