import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureUniqueOrganizationSlug, hashPassword, serializeAuthUser, slugifyOrganizationName } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { parseJsonBody } from '@/lib/validation'
import { z } from 'zod'

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  organizationName: z.string().min(1).max(120),
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

    // Pending Gumroad claim (t_55f06113): a visitor who verified a license
    // key pre-signup gets the Studio promo bound to the org on creation.
    // Only the SAME email can bind, and the claim must still be pending and
    // unexpired. GumroadClaim is a cross-tenant allowlist (NOT RLS'd) so
    // this unscoped read is safe; the claim flip below is atomic
    // (status=pending in the where) so two signups can never double-bind.
    const pendingClaim = await db.gumroadClaim.findFirst({
      where: { email, status: 'pending', expiresAt: { gt: new Date() } },
      select: { id: true, planId: true, expiresAt: true },
    })

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
          // Studio promo overlay — only ever the internal stored id ('pro'),
          // never a display label (v15 wiring law).
          ...(pendingClaim
            ? { promoPlanId: 'pro', promoPlanExpiresAt: pendingClaim.expiresAt }
            : {}),
        },
      })

      // Atomically bind the claim to the new org (single-use: the where
      // clause re-checks status=pending, so a concurrent claim cannot
      // double-grant). updateMany count 0 = lost the race or already bound.
      if (pendingClaim) {
        await tx.gumroadClaim.updateMany({
          where: { id: pendingClaim.id, status: 'pending' },
          data: { status: 'granted', organizationId: organization.id, grantedAt: new Date() },
        })

        // Grant audit — the claim flip is a promotion of record.
        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            action: 'grant',
            entityType: 'organization',
            entityId: organization.id,
            actorId: null,
            actorEmail: email,
            description: 'Gumroad promo claim granted at signup: Studio free for 1 month',
            metadata: {
              claimId: pendingClaim.id,
              planId: 'pro',
              expiresAt: pendingClaim.expiresAt.toISOString(),
            },
          },
        })
      }

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

      return user
    })

    return NextResponse.json({
      success: true,
      user: serializeAuthUser(result),
      mustChangePassword: false,
    })
  } catch (error) {
    console.error('Signup POST error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
