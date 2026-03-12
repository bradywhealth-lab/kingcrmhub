import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isInternalRunnerAuthorized } from '@/lib/internal-runner'
import { getOrgContext } from '@/lib/request-context'

/**
 * POST /api/sequences/run
 * Executes due sequence enrollments (minimal runner for follow-ups).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isInternalRunnerAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized runner request' }, { status: 401 })
    }
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const dueEnrollments = await db.sequenceEnrollment.findMany({
      where: {
        sequence: { organizationId: context.organizationId },
        status: 'active',
        OR: [{ nextStepAt: null }, { nextStepAt: { lte: now } }],
      },
      include: {
        sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
        lead: true,
      },
      take: 50,
    })

    let processed = 0
    for (const enrollment of dueEnrollments) {
      const currentStep = enrollment.sequence.steps[enrollment.currentStep]
      if (!currentStep) {
        await db.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'completed', completedAt: now },
        })
        continue
      }

      const personalized = currentStep.content
        .replaceAll('{{firstName}}', enrollment.lead.firstName || 'there')
        .replaceAll('{{company}}', enrollment.lead.company || 'your company')

      await db.activity.create({
        data: {
          organizationId: enrollment.sequence.organizationId,
          leadId: enrollment.leadId,
          type: 'sequence_step',
          title: `Sequence step: ${currentStep.type}`,
          description: personalized.slice(0, 200),
          metadata: {
            enrollmentId: enrollment.id,
            sequenceId: enrollment.sequenceId,
            stepId: currentStep.id,
            stepType: currentStep.type,
          },
        },
      })

      const nextIndex = enrollment.currentStep + 1
      const nextStep = enrollment.sequence.steps[nextIndex]
      const nextStepAt = nextStep
        ? new Date(
            now.getTime() +
              (nextStep.delayDays || 0) * 24 * 60 * 60 * 1000 +
              (nextStep.delayHours || 0) * 60 * 60 * 1000
          )
        : null

      await db.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: nextIndex,
          nextStepAt,
          status: nextStep ? 'active' : 'completed',
          completedAt: nextStep ? null : now,
        },
      })

      processed++
    }

    return NextResponse.json({ processed, totalDue: dueEnrollments.length })
  } catch (error) {
    console.error('Sequence runner error:', error)
    return NextResponse.json({ error: 'Failed to execute sequence runner' }, { status: 500 })
  }
}
