import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/sequences — List sequences for the org (elite follow-ups).
 * POST /api/sequences — Create a new sequence.
 */
const sequenceStepSchema = z.object({
  order: z.coerce.number().int().min(0),
  type: z.string().min(1),
  delayDays: z.coerce.number().int().min(0).optional(),
  delayHours: z.coerce.number().int().min(0).optional(),
  subject: z.string().optional(),
  content: z.string().default(''),
})

const createSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(3000).optional(),
  type: z.enum(['email', 'sms']).optional(),
  steps: z.array(sequenceStepSchema).optional(),
})

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const sequences = await db.sequence.findMany({
      where: { organizationId: context.organizationId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ sequences })
    })
  } catch (error) {
    console.error('Sequences GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sequences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'sequence-create', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, createSequenceSchema)
    if (!parsed.success) return parsed.response
    const { name, description, type = 'email', steps = [] } = parsed.data

    const sequence = await db.sequence.create({
      data: {
        organizationId: context.organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        type: type === 'sms' ? 'sms' : 'email',
      },
    })

    if (Array.isArray(steps) && steps.length > 0) {
      await db.sequenceStep.createMany({
        data: steps.map((s) => ({
          sequenceId: sequence.id,
          order: s.order,
          type: s.type,
          delayDays: s.delayDays ?? 0,
          delayHours: s.delayHours ?? 0,
          subject: s.subject ?? null,
          content: s.content ?? '',
        })),
      })
    }

    const withSteps = await db.sequence.findUnique({
      where: { id: sequence.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ sequence: withSteps })
    })
  } catch (error) {
    console.error('Sequences POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create sequence' },
      { status: 500 }
    )
  }
}
