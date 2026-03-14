import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const bookingSchema = z.object({
  leadId: z.string().optional(),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  title: z.string().max(200).optional(),
  description: z.string().max(3000).optional(),
})

/**
 * POST /api/bookings — Elite appointment setting: create a meeting from a booking.
 * GET /api/bookings — List upcoming (when Appointment/Activity meeting model is used).
 *
 * Expects: leadId or contact info (to create lead), start, end, timezone.
 * Creates Activity (type: meeting); optionally syncs to calendar via Integration.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'bookings-create', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, bookingSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const {
      leadId,
      firstName,
      lastName,
      email,
      phone,
      start,
      end,
      title = 'Meeting',
      description,
    } = body as {
      leadId?: string
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      start: string
      end: string
      title?: string
      description?: string
    }

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end (ISO datetime) are required' },
        { status: 400 }
      )
    }

    let resolvedLeadId = leadId
    if (!resolvedLeadId && (email || phone)) {
      let lead = await db.lead.findFirst({
        where: {
          organizationId: context.organizationId,
          OR: [
            ...(email ? [{ email: email.toLowerCase() }] : []),
            ...(phone ? [{ phone: phone.replace(/\D/g, '') }] : []),
          ],
        },
      })
      if (!lead && (firstName || lastName || email)) {
        lead = await db.lead.create({
          data: {
            organizationId: context.organizationId,
            firstName: firstName || null,
            lastName: lastName || null,
            email: email?.toLowerCase() || null,
            phone: phone || null,
            source: 'booking',
            status: 'new',
          },
        })
      }
      resolvedLeadId = lead?.id ?? null
    }

    const activity = await db.activity.create({
      data: {
        organizationId: context.organizationId,
        leadId: resolvedLeadId ?? undefined,
        type: 'meeting',
        title,
        description: description ?? null,
        metadata: {
          start: start,
          end: end,
          source: 'booking',
          // externalEventId set when calendar sync is implemented
        },
      },
    })

    return NextResponse.json({
      activityId: activity.id,
      leadId: resolvedLeadId,
      start,
      end,
      message: 'Meeting created. Connect Google Calendar in Settings to sync to calendar.',
    })
    })
  } catch (error) {
    console.error('Bookings POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const activities = await db.activity.findMany({
      where: {
        organizationId: context.organizationId,
        type: 'meeting',
      },
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ bookings: activities })
    })
  } catch (error) {
    console.error('Bookings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
