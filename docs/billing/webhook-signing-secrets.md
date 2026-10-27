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

Additionally, a verified event whose `livemode` does not match the active
billing mode (test vs live) is acknowledged with 200 and dropped — a test-mode
event can never overwrite live billing state, and vice versa.

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

These probes hit the production endpoint, so sign a **safe probe payload**: use
an event type the route ignores (`invoice.paid` — acknowledged with 200, zero DB
writes) and never a real organization's id in metadata. A validly signed probe
with a handled event type WOULD be processed as a real event and could write org
billing fields.

Expected codes assume a charge-capable Stripe client is active (test keys set).
When billing is fully off, the route is inert and every probe below returns
200 `{received: true}` — the 400s only apply once the client is active.

```bash
# 1. Unsigned request -> 400 {"error":"Missing stripe-signature"}
curl -s -w '\n%{http_code}\n' -X POST https://kingcrmhub.net/api/billing/webhook

# 2. Signed with a WRONG secret -> 400 {"error":"Invalid signature"}
ts=$(date +%s)
payload='{"id":"evt_probe_wrong","object":"event","api_version":"2026-08-26.dahlia","created":'"$ts"',"livemode":false,"type":"invoice.paid","data":{"object":{}}}'
sig="t=${ts},v1=$(printf '%s' "${ts}.${payload}" | openssl dgst -sha256 -hmac 'whsec_wrong_secret_on_purpose' -hex | sed 's/^.* //')"
curl -s -w '\n%{http_code}\n' -X POST https://kingcrmhub.net/api/billing/webhook \
  -H "stripe-signature: $sig" -H 'content-type: application/json' -d "$payload"

# 3. Signed with a CONFIGURED secret -> 200 {"received":true}
#    Set WHSEC to the endpoint's real signing secret (from the vault/env
#    process — never paste it into chat or a ticket).
ts=$(date +%s)
payload='{"id":"evt_probe_valid","object":"event","api_version":"2026-08-26.dahlia","created":'"$ts"',"livemode":false,"type":"invoice.paid","data":{"object":{}}}'
sig="t=${ts},v1=$(printf '%s' "${ts}.${payload}" | openssl dgst -sha256 -hmac "$WHSEC" -hex | sed 's/^.* //')"
curl -s -w '\n%{http_code}\n' -X POST https://kingcrmhub.net/api/billing/webhook \
  -H "stripe-signature: $sig" -H 'content-type: application/json' -d "$payload"
```

The signature is an HMAC-SHA256 of `"<timestamp>.<payload>"` sent as
`stripe-signature: t=<timestamp>,v1=<hex>` — computed locally (never on the
wire), exactly as Stripe's SDK `constructEvent` verifies it. Use `livemode:
false` while the server runs test keys; after live activation use `livemode:
true` or the mode-isolation check will (correctly) acknowledge-and-drop the
probe.
