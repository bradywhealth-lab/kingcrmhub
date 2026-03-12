import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      entityType,
      entityId,
      rating,
      feedback,
      corrections,
    } = body as {
      entityType: string
      entityId: string
      rating: number
      feedback?: string
      corrections?: Record<string, unknown>
    }

    if (!entityType || !entityId || Number.isNaN(Number(rating))) {
      return NextResponse.json(
        { error: 'entityType, entityId, and rating are required' },
        { status: 400 }
      )
    }

    const saved = await db.aIFeedback.create({
      data: {
        entityType,
        entityId,
        rating: Number(rating),
        feedback: feedback || null,
        corrections: corrections || null,
      },
    })

    return NextResponse.json({ feedback: saved })
  } catch (error) {
    console.error('AI feedback error:', error)
    return NextResponse.json({ error: 'Failed to save AI feedback' }, { status: 500 })
  }
}
