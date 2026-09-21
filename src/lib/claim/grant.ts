import { db } from '@/lib/db'
import { CLAIM_GRANT_WINDOW_DAYS, hashLicenseKey } from './gumroad'
import { isUniqueConstraintViolation } from '../prisma-errors'
import type { Prisma } from '@prisma/client'

export type GrantResult =
  | { status: 'granted'; grantId: string; expiresAt: Date }
  | { status: 'already_redeemed'; expiresAt: Date | null }
  | { status: 'expired' }

export type RedeemResult =
  | { status: 'granted'; organizationId: string; expiresAt: Date }
  | { status: 'redeemed' }
  | { status: 'expired' }
  | { status: 'mismatch' }

/**
 * Create the pre-signup grant ledger row after License API verification.
 * This is the ONLY place a ClaimGrant is minted. No Stripe client is ever
 * imported/used on this path (asserted by claim-route.test.ts).
 *
 * Rate-limiting lives in the claim route; this function only enforces the
 * DB single-use constraints (transactional, so a concurrent double-claim
 * inserts exactly one row and the other 409s).
 */
export async function createClaimGrant(params: {
  licenseKey: string
  orderEmail: string
  productId: string
  source?: string
}): Promise<GrantResult> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CLAIM_GRANT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const licenseKeyHash = hashLicenseKey(params.licenseKey)
  const orderEmail = params.orderEmail.trim().toLowerCase()

  try {
    const created = await db.claimGrant.create({
      data: {
        licenseKeyHash,
        orderEmail,
        productId: params.productId,
        source: params.source ?? 'gumroad-license',
        expiresAt,
      },
    })
    return { status: 'granted', grantId: created.id, expiresAt }
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // Single-use: a prior grant for this key OR this email+product exists.
      const existing = await db.claimGrant.findFirst({
        where: {
          OR: [{ licenseKeyHash }, { orderEmail, productId: params.productId }],
        },
        select: { expiresAt: true, redeemedAt: true },
        orderBy: { createdAt: 'desc' },
      })
      if (existing && existing.expiresAt.getTime() <= Date.now()) return { status: 'expired' }
      return {
        status: 'already_redeemed',
        expiresAt: existing ? existing.expiresAt : null,
      }
    }
    throw error
  }
}

/**
 * Redeem a pre-signup grant onto a newly created org (called from the signup
 * transaction). `claimToken` is the opaque server-issued ClaimGrant id returned
 * by POST /api/claim — never the raw license key. The org's plan is flipped to
 * the granted tier ('pro' = Studio) and the grant is marked redeemed
 * atomically. `verifyRedeemable` guards the day-31 policy: once a grant has
 * expired the org keeps its data but cannot claim a new grant into the same
 * email+product (it would already exist anyway via the unique constraint).
 */
export async function redeemClaimGrant(params: {
  claimToken: string
  orderEmail: string
  organizationId: string
}, tx?: Prisma.TransactionClient): Promise<RedeemResult> {
  const orderEmail = params.orderEmail.trim().toLowerCase()
  const client: Prisma.TransactionClient = tx ?? (db as unknown as Prisma.TransactionClient)

  // Locate the grant by its server-issued id + buyer email — the id is an
  // opaque handle, never the key; the email match pins the grant to the
  // account that verified it.
  const grant = await client.claimGrant.findFirst({
    where: {
      id: params.claimToken.trim(),
      orderEmail,
    },
  })

  if (!grant) return { status: 'mismatch' }
  if (grant.expiresAt.getTime() <= Date.now()) return { status: 'expired' }
  if (grant.redeemedAt) return { status: 'redeemed' }

  // Atomic with the caller's transaction (signup $transaction): org upgrade,
  // grant redemption, and audit row commit or roll back together. The caller
  // owns transaction/Rls semantics (signup runs as the app's DB role).
  await client.organization.update({
    where: { id: params.organizationId },
    data: {
      plan: grant.plan,
      planUpdatedAt: new Date(),
      settings: {
        ...(await getOrgSettings(client, params.organizationId)),
        grant: {
          plan: grant.plan,
          startsAt: new Date().toISOString(),
          expiresAt: grant.expiresAt.toISOString(),
          source: grant.source,
          claimGrantId: grant.id,
        },
      },
    },
  })
  await client.claimGrant.update({
    where: { id: grant.id },
    data: { organizationId: params.organizationId, redeemedAt: new Date() },
  })
  await client.auditLog.create({
    data: {
      organizationId: params.organizationId,
      action: 'grant',
      entityType: 'organization',
      entityId: params.organizationId,
      description: 'Claimed 1-month Studio (promo)',
      metadata: { claimGrantId: grant.id, productId: grant.productId },
    },
  })

  return { status: 'granted', organizationId: params.organizationId, expiresAt: grant.expiresAt }
}

async function getOrgSettings(
  client: Prisma.TransactionClient,
  organizationId: string,
): Promise<Record<string, unknown>> {
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  const settings = org?.settings
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {}
}
