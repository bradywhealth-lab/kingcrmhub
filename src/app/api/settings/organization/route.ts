import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'


const organizationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(120).optional(),
  logo: z.string().url().optional().or(z.literal('')),

  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  twoFactorRequired: z.boolean().optional(),
})

function normalizeSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const organization = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
          settings: true,
          _count: {
            select: {
              leads: true,
              users: true,
              teamMembers: true,
            },
          },
        },
      })

      if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = normalizeSettings(organization.settings)
      const sessionTimeoutMinutes = typeof settings.sessionTimeoutMinutes === 'number' ? settings.sessionTimeoutMinutes : 60
      const twoFactorRequired = settings.twoFactorRequired === true

      return NextResponse.json({
        organization: {
          ...organization,

          sessionTimeoutMinutes,
          twoFactorRequired,
          usage: {
            leadsThisMonth: organization._count.leads,
            teamSeatsUsed: organization._count.teamMembers,
          },
        },
      })
    })
  } catch (error) {
    console.error('Organization settings GET error:', error)
    return NextResponse.json({ error: 'Failed to load organization settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'organization-settings', limit: 40, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, organizationSchema)
      if (!parsed.success) return parsed.response

      const existing = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      if (!existing) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = normalizeSettings(existing.settings)
      if (parsed.data.sessionTimeoutMinutes !== undefined) settings.sessionTimeoutMinutes = parsed.data.sessionTimeoutMinutes
      if (parsed.data.twoFactorRequired !== undefined) settings.twoFactorRequired = parsed.data.twoFactorRequired

      const updated = await db.organization.update({
        where: { id: context.organizationId },
        data: {
          name: parsed.data.name?.trim(),
          slug: parsed.data.slug?.trim(),
          logo: parsed.data.logo === '' ? null : parsed.data.logo?.trim(),

          settings: settings as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
          settings: true,
        },
      })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'update',
          entityType: 'organization',
          entityId: updated.id,
          description: 'Updated organization settings',
          metadata: {
            changed: Object.keys(parsed.data),
          },
        },
      })

      return NextResponse.json({ organization: updated })
    })
  } catch (error) {
    console.error('Organization settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save organization settings' }, { status: 500 })
  }
}
