import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'

/**
 * POST /api/sequences/enroll
 * Enrolls a lead into a sequence (or reactivates enrollment).
 *
 * GET /api/sequences/enroll
 * Lists enrollments (optional filters: leadId, sequenceId).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    const sequenceId = searchParams.get('sequenceId')
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '50')))

    const enrollments = await db.sequenceEnrollment.findMany({
      where: {
        ...(leadId ? { leadId } : {}),
        ...(sequenceId ? { sequenceId } : {}),
        sequence: { organizationId: context.organizationId },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            status: true,
            aiScore: true,
          },
        },
        sequence: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ enrollments })
  } catch (error) {
    console.error('Enrollments GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { leadId, sequenceId, startNow = true } = body as {
      leadId?: string
      sequenceId?: string
      startNow?: boolean
    }

    if (!leadId || !sequenceId) {
      return NextResponse.json({ error: 'leadId and sequenceId are required' }, { status: 400 })
    }

    const [lead, sequence] = await Promise.all([
      db.lead.findFirst({
        where: { id: leadId, organizationId: context.organizationId },
      }),
      db.sequence.findFirst({
        where: { id: sequenceId, organizationId: context.organizationId },
        include: { steps: { orderBy: { order: 'asc' } } },
      }),
    ])

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    if (sequence.steps.length === 0) {
      return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 })
    }

    const firstStep = sequence.steps[0]
    const initialNextStepAt = startNow
      ? new Date()
      : new Date(
          Date.now() +
            (firstStep.delayDays || 0) * 24 * 60 * 60 * 1000 +
            (firstStep.delayHours || 0) * 60 * 60 * 1000
        )

    const enrollment = await db.sequenceEnrollment.upsert({
      where: {
        sequenceId_leadId: {
          sequenceId,
          leadId,
        },
      },
      create: {
        sequenceId,
        leadId,
        status: 'active',
        currentStep: 0,
        nextStepAt: initialNextStepAt,
      },
      update: {
        status: 'active',
        currentStep: 0,
        nextStepAt: initialNextStepAt,
        completedAt: null,
      },
    })

    await db.activity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        type: 'sequence_enrolled',
        title: `Enrolled in sequence: ${sequence.name}`,
        description: `Lead enrolled into ${sequence.type} follow-up sequence`,
        metadata: {
          enrollmentId: enrollment.id,
          sequenceId,
          stepCount: sequence.steps.length,
          startNow: !!startNow,
        },
      },
    })

    return NextResponse.json({ enrollment })
  } catch (error) {
    console.error('Enrollments POST error:', error)
    return NextResponse.json({ error: 'Failed to enroll lead into sequence' }, { status: 500 })
  }
}
