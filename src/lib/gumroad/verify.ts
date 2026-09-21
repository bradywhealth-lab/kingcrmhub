/**
 * Gumroad license verification (t_55f06113).
 *
 * Verification is done against Gumroad's public license API — no key
 * material required, the endpoint is the product permalink ID (public,
 * same class as a Stripe price ID):
 *   POST https://api.gumroad.com/v2/licenses/verify
 *     body: product_id=<permalink>, license_key=<key>
 *     -> { success, uses, purchase: { email, refunded, chargebacked, disputed } }
 *
 * Fail-closed design: ANY transport error, non-JSON body, `success:false`
 * response, or refund/chargeback/dispute flag rejects the key. A network
 * blip can never accidentally grant access.
 *
 * Manual allowlist fallback (env `GUMROAD_ALLOWLIST`): when the Gumroad
 * HTTP path is disabled (no GUMROAD_CLAIMS_ENABLED=1) or for Brady's
 * manual verification, claims can be granted off an operator-provided
 * `email,key` list. The allowlist entry's EMAIL binds the grant — the key
 * alone is never sufficient.
 *
 * The license key itself must never be logged by callers.
 */

export type GumroadPurchase = {
  email: string
  productName: string
  permalink: string
  orderNumber: number
  saleId: string
  refunded: boolean
  disputed: boolean
  chargebacked: boolean
  subscriptionId?: string | null
  recurrence?: string | null
}

export type GumroadVerifyResult =
  | { ok: true; purchase: GumroadPurchase; fromAllowlist: boolean }
  | { ok: false; reason: 'invalid' | 'refunded' | 'allowlist_mismatch' | 'unavailable' }

export type AllowlistEntry = { email: string; key: string }

export interface GumroadVerifier {
  verify(licenseKey: string, claimedEmail?: string): Promise<GumroadVerifyResult>
}

export type GumroadVerifierOptions = {
  /** `GUMROAD_PRODUCT_PERMALINK` — the product's public permalink id. */
  productId?: string
  /** Parse `GUMROAD_ALLOWLIST` (comma-separated `email,key`) into entries. */
  allowlist?: AllowlistEntry[]
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch
}

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify'

function parsePurchase(raw: {
  email?: string
  product_name?: string
  permalink?: string
  order_number?: number
  sale_id?: string
  refunded?: boolean
  disputed?: boolean
  chargebacked?: boolean
  subscription_id?: string | null
  recurrence?: string | null
} | null): GumroadPurchase | null {
  if (!raw || typeof raw.email !== 'string' || typeof raw.sale_id !== 'string') return null
  return {
    email: raw.email,
    productName: raw.product_name ?? 'Gumroad product',
    permalink: raw.permalink ?? '',
    orderNumber: raw.order_number ?? 0,
    saleId: raw.sale_id,
    refunded: raw.refunded === true,
    disputed: raw.disputed === true,
    chargebacked: raw.chargebacked === true,
    subscriptionId: raw.subscription_id ?? null,
    recurrence: raw.recurrence ?? null,
  }
}

export function parseAllowlistEnv(raw: string | undefined): AllowlistEntry[] {
  if (!raw) return []
  return raw
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [email, key] = pair.split(',').map((part) => part.trim())
      if (!email || !key) return null
      return { email: email.toLowerCase(), key }
    })
    .filter((entry): entry is AllowlistEntry => entry !== null)
}

export function createGumroadVerifier(options: GumroadVerifierOptions = {}): GumroadVerifier {
  const productId = options.productId?.trim()
  const allowlist = options.allowlist ?? []
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  return {
    async verify(licenseKey: string, claimedEmail?: string): Promise<GumroadVerifyResult> {
      const key = licenseKey.trim()
      if (!key) return { ok: false, reason: 'invalid' }

      if (allowlist.length > 0) {
        const entry = allowlist.find(
          (item) =>
            item.key.trim().toLowerCase() === key.toLowerCase() &&
            item.email.trim().toLowerCase() === String(claimedEmail ?? '').trim().toLowerCase(),
        )
        if (!entry) return { ok: false, reason: 'allowlist_mismatch' }
        return {
          ok: true,
          fromAllowlist: true,
          purchase: {
            email: entry.email,
            productName: 'Manual allowlist grant',
            permalink: '',
            orderNumber: 0,
            saleId: 'ALLOWLIST',
            refunded: false,
            disputed: false,
            chargebacked: false,
          },
        }
      }

      if (!productId) return { ok: false, reason: 'unavailable' }

      let response: Response
      try {
        const body = new URLSearchParams({ product_id: productId, license_key: key })
        response = await fetchImpl('https://api.gumroad.com/v2/licenses/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          cache: 'no-store',
        })
      } catch {
        // Transport failure — fail closed.
        return { ok: false, reason: 'unavailable' }
      }

      let data: unknown
      try {
        data = await response.json()
      } catch {
        return { ok: false, reason: 'unavailable' }
      }

      if (!response.ok || typeof data !== 'object' || data === null) {
        return { ok: false, reason: 'unavailable' }
      }

      const envelope = data as { success?: unknown; message?: unknown; purchase?: unknown }
      if (envelope.success !== true) return { ok: false, reason: 'invalid' }

      const purchase = parsePurchase(
        (envelope.purchase ?? null) as Parameters<typeof parsePurchase>[0],
      )
      if (!purchase) return { ok: false, reason: 'unavailable' }

      if (purchase.refunded || purchase.chargebacked || purchase.disputed) {
        return { ok: false, reason: 'refunded' }
      }

      return { ok: true, fromAllowlist: false, purchase }
    },
  }
}

/* Kept for reference so the tests import cleanly; the route builds the
 * verifier itself from env. */
export type { GumroadVerifyResult as _ResultAlias }
