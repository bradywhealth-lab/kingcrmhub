import { createHash } from 'node:crypto'

export const CLAIM_GRANT_WINDOW_DAYS = 30
export const CLAIM_NUDGE_DAYS = 21

/**
 * Hash a license key BEFORE it enters the ledger. Raw keys are secret-bearing
 * (Gumroad consumption state allows disabling a key), so only the SHA-256
 * hex digest is ever stored or logged. Never log the raw key.
 */
export function hashLicenseKey(licenseKey: string): string {
  return createHash('sha256').update(licenseKey).digest('hex')
}

/**
 * Server-side confirmation source (Gumroad License API — spec Option A).
 * POSTs to https://api.gumroad.com/v2/licenses/verify with form fields
 * product_id + license_key. The product_id form field is REQUIRED for
 * products created on or after 2023-01-09 (Gumroad Help 76); permalink is not
 * used. The raw license key is used for verification and immediately hashed
 * for storage — it is never written anywhere.
 *
 * The access token is optional for verify (the endpoint accepts verify without
 * a token) but is sent when configured; token and product ids are read from
 * env, never logged, and never echoed to clients.
 */
export type GumroadLicenseVerification = {
  ok: boolean
  email?: string
  productId?: string
  productName?: string
  refunded?: boolean
  disputed?: boolean
}

export async function verifyGumroadLicense(
  licenseKey: string,
  productId: string,
): Promise<GumroadLicenseVerification> {
  const accessToken = process.env.GUMROAD_ACCESS_TOKEN?.trim()
  const body = new URLSearchParams()
  body.set('product_id', productId)
  body.set('license_key', licenseKey)
  if (accessToken) body.set('access_token', accessToken)

  let res: Response
  try {
    res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Never let the request hang on a flaky Gumroad connection (spec: use a
      // bounded timeout; the claim route is public and rate-limited).
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return { ok: false }
  }

  if (res.status !== 200) {
    // Gumroad returns 200 with { success: false } for invalid keys — any
    // non-200 is a transport/config failure, not a purchase verdict.
    return { ok: false }
  }

  const data = (await res.json().catch(() => null)) as {
    success?: boolean
    purchase?: {
      email?: string
      product_id?: string
      product_name?: string
      refunded?: boolean
      disputed?: boolean
    }
  } | null

  if (!data?.success || !data.purchase?.email) {
    return { ok: false }
  }

  return {
    ok: true,
    email: data.purchase.email.toLowerCase(),
    productId: data.purchase.product_id,
    productName: data.purchase.product_name,
    refunded: data.purchase.refunded === true,
    disputed: data.purchase.disputed === true,
  }
}

/**
 * Eligible Gumroad product ids from env (GUMROAD_PRODUCT_ID_1..N). The wire
 * lane owns the file; values are read masked and never printed. An
 * unconfigured/blank id is simply not eligible.
 */
export function eligibleGumroadProductIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const ids: string[] = []
  for (let i = 1; i <= 4; i += 1) {
    const value = env[`GUMROAD_PRODUCT_ID_${i}`]?.trim()
    if (value) ids.push(value)
  }
  return ids
}

export function isEligibleGumroadProduct(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!productId) return false
  return eligibleGumroadProductIds(env).includes(productId)
}

/**
 * Public catalog of claimable products, config-gated: only products with a
 * non-blank GUMROAD_PRODUCT_ID_* env value are offered (GUMROAD_PRODUCT_ID_2
 * may be empty = prompts-only). Product id 1 = AI Prompt Arsenal, id 2 =
 * Freelancer OS — the only two eligible products per the spec decision
 * (t_7160ffb5 Q2: "AI Prompt Arsenal + Freelancer OS only"). The ids are not
 * secret (Gumroad shows them on product pages), so this is safe for the
 * public /claim page to render and select.
 */
export function claimProductCatalog(env: NodeJS.ProcessEnv = process.env): { id: string; name: string }[] {
  const ids = eligibleGumroadProductIds(env)
  const names = ['AI Prompt Arsenal', 'Freelancer OS']
  return ids.map((id, index) => ({ id, name: names[index] ?? `Product ${index + 1}` }))
}
