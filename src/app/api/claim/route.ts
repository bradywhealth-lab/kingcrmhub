import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import {
  eligibleGumroadProductIds,
  hashLicenseKey,
  isEligibleGumroadProduct,
  verifyGumroadLicense,
} from '@/lib/claim/gumroad'
import { createClaimGrant } from '@/lib/claim/grant'

/**
 * POST /api/claim — public claim flow (pre-signup entry).
 * Body: { email, licenseKey, productId }.
 *
 * Server-side purchase confirmation comes from the Gumroad License API:
 * the buyer's email + license key + eligible product id (GUMROAD_PRODUCT_ID_*).
 * On success we mint a ClaimGrant ledger row (single-use, unique on
 * licenseKeyHash and on email+product). The actual entitlement write happens
 * at signup (see src/lib/claim/redeem-signup.ts) — never here.
 *
 * SAFETY (spec t_7160ffb5 §3, mandatory):
 * - This route NEVER imports or calls any Stripe client method. The free
 *   month is a direct DB entitlement write ($0, zero-charge path); Stripe
 *   enters only via explicit user-initiated /api/billing/checkout at $39.
 * - Raw license keys are hashed before ANY storage/logging (SHA-256).
 * - No sensitive env values are echoed: GUMROAD_ACCESS_TOKEN and the product
 *   ids are read from env only.
 * - Rate limits: 5 verify attempts / 15 min per email, 10 / 15 min per IP.
 */
const claimSchema = z.object({
  email: z.string().email().max(200),
  licenseKey: z.string().min(8).max(200),
  productId: z.string().max(300).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, claimSchema)
    if (!parsed.success) return parsed.response

    const email = parsed.data.email.trim().toLowerCase()
    const licenseKey = parsed.data.licenseKey.trim()
    const productId = parsed.data.productId?.trim()

    // Single eligible product (today: AI Prompt Arsenal). No select needed.
    const candidateIds = eligibleGumroadProductIds()
    if (candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'Claim setup is not complete yet. Please try again later.' },
        { status: 503 },
      )
    }

    // Resolve the product: explicit eligible id, or the sole configured id.
    // With multiple configured products the buyer must select — silently
    // defaulting to product 1 would make Freelancer OS licenses unclaimable.
    if (candidateIds.length > 1 && !(productId && candidateIds.includes(productId))) {
      return NextResponse.json({ error: 'Select the product you purchased to continue.' }, { status: 400 })
    }
    if (productId && !candidateIds.includes(productId)) {
      return NextResponse.json({ error: 'Not an eligible product for this claim.' }, { status: 400 })
    }
    const resolvedProductId = productId && candidateIds.includes(productId) ? productId : candidateIds[0]!

    // Abuse limits — email-scoped and IP-scoped (see rate-limit.ts caveat).
    const emailLimited = enforceRateLimit(request, {
      key: `claim-verify:${email}`,
      limit: 5,
      windowMs: 15 * 60_000,
    })
    if (emailLimited) return emailLimited

    const ipLimited = enforceRateLimit(request, {
      key: 'claim-verify-ip',
      limit: 10,
      windowMs: 15 * 60_000,
    })
    if (ipLimited) return ipLimited

    // Strict single-use: the SAME license key (or email+product) cannot grant
    // twice, regardless of Gumroad's own state. Check before verifying — this
    // also absorbs the already-redeemed retry path without a Gumroad roundtrip.
    const existing = await db.claimGrant.findFirst({
      where: { OR: [{ licenseKeyHash: hashLicenseKey(licenseKey) }, { orderEmail: email, productId: resolvedProductId }] },
      select: { id: true, orderEmail: true, redeemedAt: true },
    })
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.redeemedAt !== null
              ? 'This license key has already been claimed.'
              : 'This license key has already been verified. Finish your signup to activate your free month.',
        },
        { status: 409 },
      )
    }

    // Purchase confirmation — Gumroad License API. Never log the raw key.
    const verification = await verifyGumroadLicense(licenseKey, resolvedProductId)
    if (!verification.ok || !isEligibleGumroadProduct(verification.productId ?? null)) {
      return NextResponse.json({ error: 'That license key or product was not found.' }, { status: 400 })
    }

    // The Gumroad purchase email must match the email the buyer enters. This
    // stops a key being claimed under a different address than was used to buy.
    if (verification.email !== email) {
      return NextResponse.json(
        { error: 'That license key does not match the email you entered. Check the email on your Gumroad receipt.' },
        { status: 400 },
      )
    }

    if (verification.refunded || verification.disputed) {
      return NextResponse.json({ error: 'This purchase is no longer eligible for the claim.' }, { status: 400 })
    }

    const grant = await createClaimGrant({
      licenseKey,
      orderEmail: email,
      productId: verification.productId ?? resolvedProductId,
    })

    if (grant.status === 'already_redeemed' || grant.status === 'expired') {
      return NextResponse.json({ error: 'This license key has already been claimed.' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      message: 'License verified. Finish signup to activate your free month of Studio.',
      expiresAt: grant.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Claim POST error:', error)
    return NextResponse.json({ error: 'Failed to verify license. Please try again.' }, { status: 500 })
  }
}
