# Stripe Webhook Signing Secrets — Live Production Runbook

Owner runbook for the **LIVE** billing setup on kingcrmhub.net. It covers the
actual shipped architecture: **one webhook endpoint, one signing secret**.

Verified against `src/app/api/billing/webhook/route.ts` and
`src/lib/billing/stripe.ts` on `main` (2026-10-27). If those files change,
re-check Section 4's expected responses before trusting them.

## 1. Current production setup

| Fact | Value |
| --- | --- |
| Billing mode | **LIVE** — `STRIPE_SECRET_KEY=sk_live_...` with `STRIPE_LIVE_ACTIVATION=1` |
| Webhook endpoint | **one** — `we_1UHwS1LOt82rj6dcqgN9J0F9` → `https://kingcrmhub.net/api/billing/webhook` |
| Signing secret | **one** — env var `STRIPE_WEBHOOK_SECRET` (`whsec_...`) |
| Dual-secret support | **none ships** — PR #247 (test-endpoint fallback) was closed unmerged; do not resurrect it |
| Stale test endpoint | deleted — the legacy "Brighter Health Solutions sandbox" TEST-mode endpoint no longer exists |

Consequence worth internalizing: a signing secret is **per endpoint**. A
`whsec_...` copied from any other endpoint (a new test endpoint, another
account) will **never** verify deliveries from the live endpoint. There is no
fallback secret in the shipped code — a failed verification is a hard 400.

## 2. Fetching the live signing secret (owner action)

1. Open the Stripe Dashboard → **Developers → Webhooks**.
2. Click the live endpoint — id `we_1UHwS1LOt82rj6dcqgN9J0F9`
   (`https://kingcrmhub.net/api/billing/webhook`).
3. Under **Signing secret**, click **Reveal** and copy the `whsec_...` value.

Notes:

- You can click **Reveal** again at any time — the value is stable until you
  explicitly rotate it (add a new signing secret / roll the key in Stripe).
- Treat it like a password. It authenticates *writes to org billing state*.

## 3. Applying the secret on the VPS (owner action)

The secret value moves **only** through the owner's vault/env process —
**never** via chat, tickets, PRs, screenshots, or commit messages.

The app reads `STRIPE_WEBHOOK_SECRET` from the environment **at process
start**, so an env change does nothing until the container is recreated:

```bash
cd /home/deployer/kingcrmhub
# 1. Update STRIPE_WEBHOOK_SECRET in the env source consumed by the compose
#    file (/home/deployer/docker-compose.apps.yml) — via the vault/env process.
# 2. Recreate the container so the new env is loaded:
docker stop kingcrmhub && docker rm kingcrmhub
docker compose -f /home/deployer/docker-compose.apps.yml up -d kingcrmhub
```

This stop/rm + up sequence is the same container-recreate pattern the deploy
script (`scripts/deploy-kingcrmhub.sh`) uses — but run manually it does **not**
give you the script's image backup, health check, or automatic rollback. After
recreating, confirm the app is healthy (the probes below return the expected
codes and `docker logs kingcrmhub` is clean) before treating the rotation as
complete.

**Rotation gap:** the app stores one secret, but Stripe's *roll signing
secret* feature keeps the old secret active for up to 24 hours and signs each
delivery with every active secret — prefer that overlap: roll the secret in
the dashboard, then update the env and recreate the container while the old
secret still verifies. If the old secret is expired or invalidated immediately
instead, every real delivery fails verification (400) during the gap; Stripe
retries failed deliveries for up to 3 days, which is a recovery window — not a
guarantee. If the gap outlasts it, replay missed events from Stripe
(Dashboard → Developers → Webhooks → endpoint) or reconcile billing state.
Either way, never leave the rotation half-done.

## 4. Post-change probe recipe

Three curls against the production endpoint prove the whole chain: header
check → HMAC verification → secret actually loaded.

**Safety rules — read before running:**

- Probes hit **production**. Use only an event type the route **ignores**:
  `invoice.paid` is unhandled in `route.ts` (it falls through to the
  default case, is acknowledged with 200, and performs **zero DB writes**).
- **Never** probe with a handled type (`checkout.session.completed`,
  `customer.subscription.created|updated|deleted`) — a validly signed probe
  with a real `metadata.organizationId` **would write org billing state**.
- **Never** use a real organization id in any probe payload.
- Tools: `curl` and `python3` only. The HMAC helper below feeds the signing
  secret to the local HMAC computation **via stdin — never as a
  command-line argument**, where `ps` or host monitoring could capture it.
- Run each probe promptly after generating its timestamp — Stripe signature
  tolerance is 5 minutes.

Expected responses (shipped single-secret code, live client active):

| Probe | Expected |
| --- | --- |
| No `stripe-signature` header | `400` `{"error":"Missing stripe-signature"}` |
| HMAC signed with a **wrong** secret | `400` `{"error":"Invalid signature"}` |
| HMAC signed with the **real** secret (`invoice.paid`) | `200` `{"received":true}` |

```bash
URL=https://kingcrmhub.net/api/billing/webhook

# HMAC helper: the signing secret arrives on STDIN, never as a command-line
# argument (argv is world-readable via ps; a local pipe is not).
stripe_sig() {
  python3 -c 'import hashlib,hmac,sys; secret=sys.stdin.read().encode(); ts,payload=sys.argv[1:3]; print("t=%s,v1=%s"%(ts,hmac.new(secret,(ts+"."+payload).encode(),hashlib.sha256).hexdigest()))' "$1" "$2"
}

# 1. Unsigned -> 400 {"error":"Missing stripe-signature"}
curl -s -w '\n%{http_code}\n' -X POST "$URL"

# 2. Signed with a WRONG secret -> 400 {"error":"Invalid signature"}
ts=$(date +%s)
payload='{"id":"evt_probe_wrong","object":"event","api_version":"2026-08-26.dahlia","created":'"$ts"',"livemode":true,"type":"invoice.paid","data":{"object":{}}}'
sig=$(printf '%s' 'whsec_wrong_on_purpose' | stripe_sig "$ts" "$payload")
curl -s -w '\n%{http_code}\n' -X POST "$URL" \
  -H "stripe-signature: $sig" -H 'content-type: application/json' -d "$payload"

# 3. Signed with the REAL secret -> 200 {"received":true}
#    Paste the whsec_... revealed in Section 2 when prompted (hidden input,
#    never lands in shell history or this transcript).
read -r -s -p 'Stripe signing secret: ' WHSEC; printf '\n'
ts=$(date +%s)
payload='{"id":"evt_probe_valid","object":"event","api_version":"2026-08-26.dahlia","created":'"$ts"',"livemode":true,"type":"invoice.paid","data":{"object":{}}}'
sig=$(printf '%s' "$WHSEC" | stripe_sig "$ts" "$payload")
curl -s -w '\n%{http_code}\n' -X POST "$URL" \
  -H "stripe-signature: $sig" -H 'content-type: application/json' -d "$payload"
unset WHSEC
```

How the signature works: Stripe signs `"<unix-timestamp>.<raw-body>"` with
HMAC-SHA256 and the endpoint's secret, and the header carries it as
`stripe-signature: t=<timestamp>,v1=<hex>`. The route's
`constructEvent(body, signature, secret)` recomputes exactly that HMAC with
the env-configured secret — the `stripe_sig` helper produces exactly that
format (secret via stdin, timestamp + payload as arguments), so a locally
computed signature with the correct secret verifies, and anything else is
rejected.

## 5. Reading the results

| Observation | Meaning | Fix |
| --- | --- | --- |
| All three probes return expected codes | Chain healthy; env secret loaded and matching the live endpoint | None |
| **Even the unsigned probe returns `200 {"received":true}`** | Route is **inert** — the running container lacks `STRIPE_WEBHOOK_SECRET` OR a charge-capable Stripe client (`STRIPE_SECRET_KEY` missing/malformed, or a live key without `STRIPE_LIVE_ACTIVATION=1`) | Check all three billing env vars, fix the env, recreate the container, re-probe — do not rotate a correct webhook secret |
| Probe 3 returns `400 {"error":"Invalid signature"}` | Secret mismatch — wrong endpoint's secret, or the env value carries a trailing newline/whitespace, or the container is still running the old env | Re-reveal the secret for `we_1UHwS1LOt82rj6dcqgN9J0F9`, fix the env value, recreate the container, re-probe |
| `5xx` / connection errors | App or proxy problem, not signing | Check `docker logs kingcrmhub` |

## 6. Never do

- **Never** paste a `whsec_...` value into chat, tickets, PRs, screenshots, or
  commit messages — vault/env process only.
- **Never** pass the signing secret as a command-line argument — argv is
  world-readable via `ps`; the helper above takes it on stdin.
- **Never** probe with handled event types or real organization ids.
- **Never** copy a secret from a different endpoint — per-endpoint secrets
  never cross-verify.
- **Never** resurrect the dual-secret fallback (PR #247, closed unmerged)
  without a new sanctioned decision.
- **Never** rotate-and-forget: reveal in the dashboard **and** recreate the
  container, in that order, close together.
