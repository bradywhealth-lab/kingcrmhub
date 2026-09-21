import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { hashLicenseKey } from './gumroad'
import { redeemClaimGrant } from './grant'

/**
 * Signup-side redemption hook. The /claim page verified a Gumroad license and
 * minted a pre-signup ClaimGrant; when signup passes `claimToken` (a base64
 * envelope with the license key, minted client-side after verification) the
 * org is upgraded to the granted tier ('pro' = Studio) atomically inside the
 * SAME transaction.
 *
 * Returns { applied: false } when no claimToken was provided — signup
 * continues as normal. A SUPPLIED-but-invalid token THROWS (transaction
 * rollback): a verified buyer must never end up with a free-tier account that
 * silently lost their month.
 *
 * The envelope contains no secrets beyond what the buyer already holds (their
 * own license key). Raw keys never hit the ledger — hashed before storage.
 */
export function decodeClaimToken(
  claimToken: string | undefined,
): { licenseKey: string } | null {
  if (!claimToken) return null
  try {
    const raw = Buffer.from(claimToken, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as { licenseKey?: unknown; productId?: unknown }
    if (typeof parsed.licenseKey !== 'string' || parsed.licenseKey.length < 8 || parsed.licenseKey.length > 200) {
      return null
    }
    return { licenseKey: parsed.licenseKey }
  } catch {
    return null
  }
}

export async function redeemClaimGrantAtSignup(params: {
  email: string
  claimToken?: string
  organizationId: string
  tx: Prisma.TransactionClient
}): Promise<{ applied: boolean }> {
  const decoded = decodeClaimToken(params.claimToken)
  if (params.claimToken && !decoded) {
    // A supplied-but-invalid token must never look like a plain signup: reject
    // loudly so a confused buyer retries /claim instead of silently losing the
    // verified grant (cubic P1 round 1).
    throw new ClaimTokenUnusableError('mismatch')
  }
  if (!decoded) return { applied: false }

  // Hash the key BEFORE any transaction/read; never store the raw value.
  const result = await redeemClaimGrant(
    {
      licenseKeyHash: hashLicenseKey(decoded.licenseKey),
      orderEmail: params.email,
      organizationId: params.organizationId,
    },
    params.tx,
  )

  if (result.status === 'expired' || result.status === 'mismatch' || result.status === 'redeemed') {
    throw new ClaimTokenUnusableError(result.status)
  }

  return { applied: true }
}

export class ClaimTokenUnusableError extends Error {
  constructor(
    public readonly status: 'expired' | 'mismatch' | 'redeemed',
  ) {
    super(`Claim token unusable: ${status}`)
    this.name = 'ClaimTokenUnusableError'
  }
}

/** Fetch the pre-signup grant row (for the claim page success state). */
export async function findClaimGrantForEmail(email: string, productId: string) {
  return db.claimGrant.findFirst({
    where: { orderEmail: email.trim().toLowerCase(), productId },
    select: { id: true, expiresAt: true, redeemedAt: true },
  })
}
