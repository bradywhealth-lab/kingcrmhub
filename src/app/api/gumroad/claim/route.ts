import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { createGumroadVerifier, parseAllowlistEnv, type GumroadVerifier } from '@/lib/gumroad/verify'
import { PROMO_DURATION_MS, effectivePlanId, promoLabel, type PromoOrgFields } from '@/lib/billing/promos'
import { isUniqueConstraintViolation } from '@/lib/prisma-errors'
import { z } from 'zod'

/**
 * POST /api/gumroad/claim — public purchase → account claim (t_55f06113).
 *
 * Brady decision record 2026-09-21:
 * - Entry: public /claim pre-signup. Works for BOTH visitors (pending
 *   claim bound at signup) and signed-in users (org upgraded immediately).
 * - Tier: exactly Studio = stored id `pro`. Never label `studio`.
 * - Grant mechanics: direct DB entitlement write (promo columns +
 *   ClaimGrant.expiresAt = 30 days, $0). NEVER touches Stripe and never
 *   creates a subscription; Stripe only enters via explicit user
 *   checkout at $39. STRIPE_LIVE_ACTIVATION is irrelevant to claims.
 * - Single-use + rate-limited claim keys; AuditLog entries.
 * - No Gumroad webhook (out of scope).
 *
 * Fail-closed contract (Sentinel-gated):
 * - duplicate claim                -> 409
 * - invalid key / unmatched email  -> 400 with GENERIC message
 * - refunded / disputed / chargebacked -> 403
 * - unconfigured                   -> 503
 * - license key NEVER persisted (only sha256) and NEVER logged.
 *
 * RLS: GumroadClaim is a cross-tenant allowlist, deliberately absent from
 * rls.sql — pre-signup rows (organizationId NULL) are created by anonymous
 * users and read by whatever org claims them. Do NOT add it to rls.sql.
 */

const claimSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  licenseKey: z.string().min(8).max(200),
})

type AuthUser = {
  id?: string
  email?: string | null
  organizationId?: string
  organization?: { id?: string; plan?: string | null } | null
}

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseClaimBody(request)
    if (parsed instanceof NextResponse) return parsed

    const { email, licenseKey } = parsed

    const limited = enforceRateLimit(request, {
      key: `gumroad-claim:${email}`,
      limit: 10,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    // Env-gated verification source. GUMROAD_CLAIMS_ENABLED=1 turns on the
    // live Gumroad license API (Brady toggles keys/permalinks on Gumroad;
    // secret config lands via OpsForge vault env — never chat).
    const useGumroadHttp = process.env.GUMROAD_CLAIMS_ENABLED === '1'
    const verifier = createGumroadVerifier({
      productId: process.env.GUMROAD_PRODUCT_PERMALINK,
      allowlist: useGumroadHttp ? [] : parseAllowlistEnv(process.env.GUMROAD_ALLOWLIST),
    })

    const result = await verifier.verify(licenseKey, email)
    if (!result.ok) {
      // Fail closed with generic messages. The license key must never
      // appear in the response or in logs.
      switch (result.reason) {
        case 'refunded':
          return NextResponse.json(
            { error: 'This purchase key is no longer eligible. Contact support if you believe this is a mistake.' },
            { status: 403 },
          )
        case 'allowlist_mismatch':
        case 'invalid':
          return NextResponse.json(
            { error: 'The license key and email do not match a valid purchase.' },
            { status: 400 },
          )
        default:
          return NextResponse.json(
            { error: 'Licensing verification is temporarily unavailable. Please try again shortly.' },
            { status: 503 },
          )
      }
    }

    // The Gumroad purchase email must match the claimed email (binding).
    if (result.purchase.email.trim().toLowerCase() !== email) {
      return NextResponse.json(
        { error: 'The license key and email do not match a valid purchase.' },
        { status: 400 },
      )
    }

    const purchaseRef = `gumroad:${result.purchase.saleId}`
    const keyHash = hashLicenseKey(licenseKey)
    const expiresAt = new Date(Date.now() + PROMO_DURATION_MS)

    // Single-use: any prior claim for the same purchase blocks re-claims
    // (idempotency + duplicate -> 409 contract).
    const existing = await db.gumroadClaim.findFirst({
      where: { purchaseRef },
      select: { id: true, status: true, organizationId: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'This purchase has already been claimed.' }, { status: 409 })
    }

    const session = await getServerSession(buildNextAuthOptions())
    const user = session?.user as AuthUser | undefined
    const organizationId = user?.organizationId ?? user?.organization?.id ?? null

    // Bind to an org when the user is signed in; otherwise park the claim
    // as pending — the signup route applies it at account creation.
    if (organizationId) {
      try {
        // Organization + AuditLog are RLS-scoped tables: the writes must run
        // inside the org RLS transaction or the UPDATE silently matches zero
        // rows (fail-closed under RLS) and the claim grant never lands.
        await withOrgRlsTransaction(organizationId, async () => {
          await db.organization.update({
            where: { id: organizationId },
            data: {
              promoPlanId: 'pro',
              promoPlanExpiresAt: expiresAt,
            },
          })

          await db.auditLog.create({
            data: {
              organizationId,
              action: 'grant',
              entityType: 'organization',
              entityId: organizationId,
              actorId: user?.id ?? null,
              actorEmail: user?.email ?? email,
              description: 'Gumroad promo claim granted: Studio free for 1 month',
              metadata: {
                purchaseRef,
                planId: 'pro',
                expiresAt: expiresAt.toISOString(),
              },
            },
          })

          // GumroadClaim is deliberately NOT in the rls.sql tenant list
          // (cross-tenant allowlist) — creating it inside the org txn is
          // safe and keeps the grant atomic with the org update.
          await db.gumroadClaim.create({
            data: {
              email,
              purchaseRef,
              keyHash,
              planId: 'pro',
              expiresAt,
              organizationId,
              status: 'granted',
              grantedAt: new Date(),
            },
          })
        })
      } catch (error) {
        console.error('Gumroad claim org grant failed', { purchaseRef })
        return NextResponse.json(
          { error: 'Your claim was validated but could not be applied. Please try again shortly.' },
          { status: 500 },
        )
      }

      const org = user?.organization as PromoOrgFields | null | undefined
      return NextResponse.json({
        status: 'granted',
        plan: effectivePlanId({
          plan: org?.plan ?? 'free',
          promoPlanId: 'pro',
          promoPlanExpiresAt: expiresAt,
        }),
        label: promoLabel('pro'),
        expiresAt: expiresAt.toISOString(),
      })
    }

    // Pending claim — visitor path. Signup applies it to the new org.
    // A concurrent double-verify can still race past the findFirst guard;
    // the purchaseRef UNIQUE constraint is the final single-use backstop —
    // map the resulting P2002 to the same 409 instead of an opaque 500.
    let claim: { id: string }
    try {
      claim = await db.gumroadClaim.create({
        data: {
          email,
          purchaseRef,
          keyHash,
          planId: 'pro',
          expiresAt,
          organizationId: null,
          status: 'pending',
        },
      })
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return NextResponse.json({ error: 'This purchase has already been claimed.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      status: 'pending',
      claimId: claim.id,
      label: promoLabel('pro'),
      expiresAt: expiresAt.toISOString(),
      message:
        'Purchase verified. Finish creating your free account and your 1-month Studio trial will be waiting for you.',
    })
  } catch (error) {
    console.error('Gumroad claim error', error)
    return NextResponse.json({ error: 'Could not process the claim. Please try again.' }, { status: 500 })
  }
}

async function parseClaimBody(
  request: NextRequest,
): Promise<{ email: string; licenseKey: string } | NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = claimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email and license key are required.' }, { status: 400 })
  }
  return parsed.data
}

function hashLicenseKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}
