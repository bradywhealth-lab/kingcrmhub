# STRIPE_INTEGRATION_TODO.md

Single source of truth for the Stripe Checkout integration state (KingCRMHub).

## Scenario

**Scenario A** — an existing Checkout Session API call was found and synced
against the Checkout Studio configuration. No new routes, no new files beyond
this TODO, no refactoring. All `sample_only` parameters already carried real,
non-placeholder values and were preserved unchanged.

## Values to Replace

**There are no placeholder values.** Every parameter in
`src/app/api/billing/checkout/route.ts` uses real, production-configured
values:

| Field | Current Value | Status |
|-------|--------------|--------|
| mode | `subscription` | Real (recurring SaaS billing — do NOT change to `payment`) |
| success_url | `${APP_BASE_URL}/pricing?checkout=success&plan={planId}` | Real |
| cancel_url | `${APP_BASE_URL}/pricing?checkout=canceled&plan={planId}` | Real |
| line_items[].price | env-driven price ID per plan (`STRIPE_PRICE_*_MONTHLY`) | Real — set via env, never hardcoded |

## Configured Parameters

These parameters were configured in Checkout Studio and are now set in
`src/app/api/billing/checkout/route.ts` inside the `checkout.sessions.create`
call:

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` — accepted only while the pinned API version (`2026-08-26.dahlia` in `src/lib/billing/stripe.ts`) supports it (SDK ^22.6.2 ≥ 21.0.0 covers the types; runtime acceptance is the pin). Verify the pin before any API-version rollback. |
| mode | `subscription` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` (mode is `subscription`, so included per rule) |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

Preserved existing behavior: `customer` / `customer_email`, `line_items`,
`metadata`, `subscription_data`, success/cancel URLs — unchanged.

## Environment Variables

Names already consistent between `.env` and code (no Vite, so no `VITE_`
prefix concerns):

| Variable | Where |
|----------|-------|
| `STRIPE_SECRET_KEY` | `src/lib/billing/stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | `src/lib/billing/stripe.ts` (consumed by the webhook route via `stripeWebhookSecret()`) |
| `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_STUDIO_MONTHLY` / `STRIPE_PRICE_ELITE_MONTHLY` | `src/lib/billing/plans.ts` price map |
| `APP_BASE_URL` | checkout success/cancel URL base |
| `STRIPE_LIVE_ACTIVATION` | Live-mode gate — must stay empty for test mode |

## Flow Overview

1. Frontend (`crm-pricing-page.tsx`) calls `POST /api/billing/checkout` with
   `planId` + `interval: 'monthly'`.
2. Server creates a Stripe Checkout Session (hosted full-page mode) with the
   ui-synced parameters above.
3. Server returns `{ status: 'checkout', url }`; frontend redirects to the
   Stripe-hosted page.
4. After payment, Stripe redirects to `success_url` with the plan.
5. Webhook (`/api/billing/webhook`) verifies the `whsec_` signature and
   `customer.subscription.created/updated/deleted` events flip the org plan in
   the DB.

## Testing

- Test mode is wired and live (`/api/billing/status` → `mode=test`). Use the
  test card **4242 4242 4242 4242**, any future expiry, any CVC.
- Zero real charges are possible while `STRIPE_LIVE_ACTIVATION` is empty.
- Live activation requires: Stripe account verification (business + payout
  bank), live prices, `sk_live_` + `whsec_live_` in the env, then
  `STRIPE_LIVE_ACTIVATION=1` on Brady's explicit word.

## Next Steps

- Keep the dashboard list running: activate live payments → copy the 3 prices
  to live mode → grab live `sk_` + `whsec_` → fill `stripe-wire.env` → say
  "live file updated".
- Resources: https://support.stripe.com and https://docs.stripe.com/mcp
