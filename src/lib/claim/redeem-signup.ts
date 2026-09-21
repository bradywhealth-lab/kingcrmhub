import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { hashLicenseKey } from './gumroad'
import { redeemClaimGrant } from './grant'

/**
 * Signup-side redemption hook. The /claim page verified a Gumroad license and
 * minted a pre-signup ClaimGrant; when signup passes `claimToken` (a base64
 * envelope with licenseKey + productId, minted client-side after verification)
 * and the account succeeds, the org is upgraded to the granted tier ('pro'
 * = Studio) atomically inside the SAME transaction.
 *
 * Returns null when no claimToken was provided — signup continues as normal.
 * On failure the signup itself is REJECTED (transaction rollback): a buyer
 * who verified a valid license must not end up with a free-tier account that
 * silently lost their month.
 *
 * The envelope contains no secrets beyond what the buyer already holds (their
 * own license key). Raw keys never hit the ledger — hashed before storage.
 */
export function decodeClaimToken(
  claimToken: string | undefined,
): { licenseKey: string; productId: string } | null {
  if (!claimToken) return null
  try {
    const raw = Buffer.from(claimToken, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as { licenseKey?: unknown; productId?: unknown }
    if (
      typeof parsed.licenseKey !== 'string' ||
      parsed.licenseKey.length < 8 ||
      parsed.licenseKey.length > 200 ||
      typeof parsed.productId !== 'string' ||
      parsed.productId.length === 0 ||
      parsed.productId.length > 300
    ) {
      return null
    }
    return { licenseKey: parsed.licenseKey, productId: parsed.productId }
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
  if (!decoded) return { applied: false }

  // Hash the key BEFORE any transaction/read; never store the raw value.
  const result = await redeemClaimGrant(
    {
      licenseKeyHash: hashLicenseKey(decoded.licenseKey),
      orderEmail: params.email,
      productId: decoded.productId,
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
