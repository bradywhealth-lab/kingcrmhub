import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUniqueOrganizationSlug, hashPassword, serializeAuthUser, slugifyOrganizationName } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { parseJsonBody } from '@/lib/validation'
import { redeemClaimGrantAtSignup, ClaimTokenUnusableError } from '@/lib/claim/redeem-signup'
import { z } from 'zod'

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  organizationName: z.string().min(1).max(120),
  claimToken: z.string().max(300).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, signupSchema)
    if (!parsed.success) return parsed.response

    const email = parsed.data.email.trim().toLowerCase()
    const limited = enforceRateLimit(request, {
      key: `auth-signup:${email}`,
      limit: 5,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
    }

    const slug = await ensureUniqueOrganizationSlug(slugifyOrganizationName(parsed.data.organizationName))
    const passwordHash = hashPassword(parsed.data.password)

    const result = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: parsed.data.organizationName.trim(),
          slug,
          // Review fix (Cubic P2): landing promises "Claim your free account" —
          // new orgs start on the free plan; upgrades go through billing/checkout.
          plan: 'free',
        },
      })

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: parsed.data.name.trim(),
          role: 'owner',
          organizationId: organization.id,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      })

      await tx.teamMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'owner',
          isActive: true,
        },
      })

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          action: 'create',
          entityType: 'user',
          entityId: user.id,
          actorId: user.id,
          actorEmail: user.email,
          description: 'Created owner account and initialized workspace',
          metadata: {
            organizationSlug: organization.slug,
            plan: organization.plan,
          },
        },
      })

      // Claim redemption (promo → 1-month Studio): when the signup carries a
      // claimToken, upgrade the org to the granted tier INSIDE this
      // transaction. Any failure rejects the whole signup — a verified buyer
      // never lands on a free org that silently lost their month. (GRANT PATH
      // — a direct DB entitlement write; Stripe is never touched. The tx
      // client is explicit so the redeem commits/rolls back atomically with
      // the org + user creation.)
      await redeemClaimGrantAtSignup({
        email,
        claimToken: parsed.data.claimToken,
        organizationId: organization.id,
        tx,
      })

      // Re-read after redemption so the response reflects the granted tier
      // (cubic P2 round 1: the pre-redemption user object reported plan free).
      const refreshedUser = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          organization: { select: { id: true, name: true, slug: true, plan: true } },
        },
      })

      return refreshedUser ?? user
    })

    return NextResponse.json({
      success: true,
      user: serializeAuthUser(result),
      mustChangePassword: false,
    })
  } catch (error) {
    // User-correctable claim state is a 4xx, not a 500: a mismatched email at
    // signup vs. verification, a retried signup after the grant was already
    // redeemed, or an expired grant are all fixable by the buyer (cubic P2
    // round 1 — never imply infrastructure failure for a state the user can fix).
    if (error instanceof ClaimTokenUnusableError) {
      const messages: Record<string, string> = {
        mismatch: 'The claim did not match. Use the exact email you entered on the claim page.',
        redeemed: 'This claim has already been used for an account. Sign in instead.',
        expired: 'This claim has expired after 30 days.',
      }
      return NextResponse.json(
        { error: messages[error.status] ?? 'This claim could not be applied.' },
        { status: 409 },
      )
    }
    console.error('Signup POST error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
