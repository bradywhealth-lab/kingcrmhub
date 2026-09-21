import type { Prisma } from '@prisma/client'
import { redeemClaimGrant } from './grant'

/**
 * Signup-side redemption hook. The /claim page verified a Gumroad license and
 * minted a pre-signup ClaimGrant; when signup passes `claimToken` — the opaque,
 * server-issued ClaimGrant id returned by POST /api/claim — the org is
 * upgraded to the granted tier ('pro' = Studio) atomically inside the SAME
 * transaction.
 *
 * Returns { applied: false } when no claimToken was provided — signup
 * continues as normal. A SUPPLIED-but-invalid token THROWS (transaction
 * rollback): a verified buyer must never end up with a free-tier account that
 * silently lost their month.
 *
 * Security: the token is a server-issued grant handle (cuid), never the raw
 * license key — the key never sits in a URL, referrer, or browser history
 * (cubic P2 round 1). Possession of the id only redeems when the grant is
 * still unredeemed AND the signup email matches the verified order email.
 */
export function decodeClaimToken(claimToken: string | undefined): string | null {
  if (!claimToken) return null
  const candidate = claimToken.trim()
  // ClaimGrant ids are Prisma cuid() strings: start with lowercase 'c' followed
  // by lowercase letters/digits, ~20-30 chars total. Lowercase-only + the 'c'
  // prefix rules out base64 key envelopes (which contain A-Z) — the raw
  // license key can never pass as a token.
  if (!/^c[a-z0-9]{19,29}$/.test(candidate)) return null
  return candidate
}

export async function redeemClaimGrantAtSignup(params: {
  email: string
  claimToken?: string
  organizationId: string
  tx: Prisma.TransactionClient
}): Promise<{ applied: boolean }> {
  const grantId = decodeClaimToken(params.claimToken)
  if (params.claimToken && !grantId) {
    // A supplied-but-invalid token must never look like a plain signup: reject
    // loudly so a confused buyer retries /claim instead of silently losing the
    // verified grant (cubic P1 round 1).
    throw new ClaimTokenUnusableError('mismatch')
  }
  if (!grantId) return { applied: false }

  const result = await redeemClaimGrant(
    {
      claimToken: grantId,
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
