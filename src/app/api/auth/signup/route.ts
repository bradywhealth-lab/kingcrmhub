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
