import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/sequences — List sequences for the org (elite follow-ups).
 * POST /api/sequences — Create a new sequence.
 */
const ORGANIZATION_ID = 'demo-org-1'

export async function GET() {
  try {
    const sequences = await db.sequence.findMany({
      where: { organizationId: ORGANIZATION_ID },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ sequences })
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
    const body = await request.json()
    const { name, description, type = 'email', steps = [] } = body as {
      name: string
      description?: string
      type?: string
      steps?: { order: number; type: string; delayDays?: number; delayHours?: number; subject?: string; content: string }[]
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const sequence = await db.sequence.create({
      data: {
        organizationId: ORGANIZATION_ID,
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
  } catch (error) {
    console.error('Sequences POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create sequence' },
      { status: 500 }
    )
  }
}
