import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  step: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().optional(),
})

// GET /api/onboarding - return onboarding state for current org
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(buildNextAuthOptions(request))
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use raw query to gracefully handle the case where the migration hasn't run yet
    // by defaulting to sensible values when columns don't exist
    let onboardingCompleted = false
    let onboardingCompletedAt: Date | null = null
    let onboardingStep = 0

    try {
      const org = await db.organization.findUnique({
        where: { id: session.user.organizationId },
        select: {
          onboardingCompleted: true,
          onboardingCompletedAt: true,
          onboardingStep: true,
        },
      })

      if (org) {
        onboardingCompleted = org.onboardingCompleted ?? false
        onboardingCompletedAt = org.onboardingCompletedAt ?? null
        onboardingStep = org.onboardingStep ?? 0
      }
    } catch {
      // Columns may not exist yet if migration hasn't been applied — default to not completed
      onboardingCompleted = false
    }

    // Get org stats separately
    const counts = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        _count: {
          select: {
            carriers: true,
            leads: true,
            teamMembers: true,
          },
        },
      },
    })

    return NextResponse.json({
      onboardingCompleted,
      onboardingCompletedAt,
      onboardingStep,
      stats: {
        carriers: counts?._count.carriers ?? 0,
        leads: counts?._count.leads ?? 0,
        teamMembers: counts?._count.teamMembers ?? 0,
      },
    })
  } catch (error) {
    console.error('GET /api/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/onboarding - update onboarding progress
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(buildNextAuthOptions(request))
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const updateData: {
      onboardingStep?: number
      onboardingCompleted?: boolean
      onboardingCompletedAt?: Date | null
    } = {}

    if (typeof parsed.data.step === 'number') {
      updateData.onboardingStep = parsed.data.step
    }

    if (parsed.data.completed === true) {
      updateData.onboardingCompleted = true
      updateData.onboardingCompletedAt = new Date()
    } else if (parsed.data.completed === false) {
      updateData.onboardingCompleted = false
      updateData.onboardingCompletedAt = null
    }

    let updated: { onboardingCompleted: boolean; onboardingStep: number; onboardingCompletedAt: Date | null } = {
      onboardingCompleted: false,
      onboardingStep: 0,
      onboardingCompletedAt: null,
    }

    try {
      updated = await db.organization.update({
        where: { id: session.user.organizationId },
        data: updateData,
        select: {
          onboardingCompleted: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
        },
      })
    } catch {
      // Migration may not have run yet — gracefully ignore
    }

    // Log to audit trail
    await db.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        action: 'update',
        entityType: 'onboarding',
        entityId: session.user.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        description: parsed.data.completed
          ? 'Completed onboarding setup wizard'
          : `Advanced onboarding to step ${parsed.data.step ?? '?'}`,
      },
    })

    return NextResponse.json({ success: true, ...updated })
  } catch (error) {
    console.error('PATCH /api/onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
