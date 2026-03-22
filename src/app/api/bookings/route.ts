import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { getOrgContext, withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import {
  getBookingOrganizationBySlug,
  getGoogleCalendarSyncStub,
} from '@/lib/booking'

const bookingSchema = z.object({
  slug: z.string().min(1).optional(),
  leadId: z.string().optional(),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  timezone: z.string().max(80).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(3000).optional(),
})

type BookingPayload = z.infer<typeof bookingSchema>

async function createBookingForOrganization(
  organizationId: string,
  userId: string | null,
  payload: BookingPayload
) {
  return withOrgRlsTransaction(organizationId, async () => {
    const {
      slug,
      leadId,
      firstName,
      lastName,
      email,
      phone,
      start,
      end,
      timezone,
      title = 'Insurance strategy session',
      description,
    } = payload

    let resolvedLeadId = leadId

    if (!resolvedLeadId && (email || phone)) {
      let lead = await db.lead.findFirst({
        where: {
          organizationId,
          OR: [
            ...(email ? [{ email: email.toLowerCase() }] : []),
            ...(phone ? [{ phone: phone.replace(/\D/g, '') }] : []),
          ],
        },
      })

      if (!lead && (firstName || lastName || email)) {
        lead = await db.lead.create({
          data: {
            organizationId,
            firstName: firstName || null,
            lastName: lastName || null,
            email: email?.toLowerCase() || null,
            phone: phone || null,
            source: 'booking',
            status: 'qualified',
            pipelineStage: 'Meeting scheduled',
          },
        })
      }

      resolvedLeadId = lead?.id
    }

    const activity = await db.activity.create({
      data: {
        organizationId,
        userId: userId ?? undefined,
        leadId: resolvedLeadId ?? undefined,
        type: 'meeting',
        title,
        description: description ?? null,
        metadata: {
          start,
          end,
          timezone: timezone ?? 'UTC',
          source: slug ? 'public_booking' : 'booking',
          bookingSlug: slug ?? null,
          externalEventId: null,
        },
      },
    })

    const calendarSync = await getGoogleCalendarSyncStub(organizationId)

    return NextResponse.json({
      activityId: activity.id,
      leadId: resolvedLeadId,
      start,
      end,
      calendarSync,
      message: calendarSync.message,
    })
  })
}

/**
 * POST /api/bookings — create a meeting from an internal or public booking flow.
 * GET /api/bookings — list upcoming meetings for the authenticated organization.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'bookings-create', limit: 80, windowMs: 60_000 })
    if (limited) return limited

    const parsed = await parseJsonBody(request, bookingSchema)
    if (!parsed.success) return parsed.response

    const payload = parsed.data
    if (!payload.start || !payload.end) {
      return NextResponse.json(
        { error: 'start and end (ISO datetime) are required' },
        { status: 400 }
      )
    }

    const authenticatedContext = await getOrgContext(request)
    if (authenticatedContext) {
      return createBookingForOrganization(
        authenticatedContext.organizationId,
        authenticatedContext.userId,
        payload
      )
    }

    if (!payload.slug) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const organization = await getBookingOrganizationBySlug(payload.slug)
    if (!organization) {
      return NextResponse.json(
        { error: 'Booking page not found' },
        { status: 404 }
      )
    }

    return createBookingForOrganization(organization.id, null, payload)
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
