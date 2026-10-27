# Stripe Webhook Signing Secrets — Runbook

Each Stripe webhook endpoint has its **own** signing secret (`whsec_...`).
A secret copied from one endpoint will never verify deliveries from another —
this is the root cause of the 2026-10 test-mode delivery failures to
`https://kingcrmhub.net/api/billing/webhook` (Stripe reported non-2xx on every
delivery: test-mode events were signed with the TEST endpoint's secret while
the server only accepted the primary one).

## What the code accepts

`src/app/api/billing/webhook/route.ts` verifies each delivery against, in order:

1. `STRIPE_WEBHOOK_SECRET` — the primary endpoint's signing secret
2. `STRIPE_WEBHOOK_SECRET_TEST` — the TEST-mode endpoint's signing secret
   (fallback; only attempted when the primary secret fails to verify)

A delivery is accepted (200) when EITHER secret verifies. It is rejected (400)
when every configured secret fails, or when the billing client is active but no
signing secret is configured at all. When billing is fully off (no charge-capable
Stripe client), the route stays inert (200 `{received: true}`) as before.

## Fetching a signing secret (owner action)

1. Open the Stripe Dashboard → **Developers → Webhooks**.
2. Click the webhook endpoint you need (there is one per mode — test and live).
3. Under **Signing secret**, click **Reveal** and copy the `whsec_...` value.
   - Test-mode endpoint secret → `STRIPE_WEBHOOK_SECRET_TEST`
   - Live-mode endpoint secret → `STRIPE_WEBHOOK_SECRET`

## Applying it on the VPS (owner action)

The secret value goes into the server environment through the owner's
vault/env process — **never paste a `whsec_...` value into chat, tickets, PRs,
or commit messages.** After changing the env on the VPS, the container must be
recreated to pick it up (env is read at process start):

```bash
cd /home/deployer/kingcrmhub
docker stop kingcrmhub && docker rm kingcrmhub
docker compose -f /home/deployer/docker-compose.apps.yml up -d kingcrmhub
```

## Verifying the endpoint after a change

```bash
# 1. Unsigned request -> must be 400 {"error":"Missing stripe-signature"}
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://kingcrmhub.net/api/billing/webhook

# 2. Signed with a wrong secret -> must be 400 {"error":"Invalid signature"}

# 3. Signed with a configured secret -> must be 200 {"received":true}
```

Sign a probe payload locally (never on the wire) with the same secret the
endpoint has configured, e.g. via Stripe's `constructEvent` or an HMAC-SHA256
of `"<timestamp>.<payload>"` sent as `stripe-signature: t=<timestamp>,v1=<hex>`.
