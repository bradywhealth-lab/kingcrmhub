import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'

const createAppointmentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().optional(),
  location: z.string().max(500).optional(),
  leadId: z.string().optional(),
  attendeeName: z.string().max(200).optional(),
  attendeeEmail: z.string().email().optional(),
})

const updateAppointmentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  timezone: z.string().optional(),
  location: z.string().max(500).nullable().optional(),
  leadId: z.string().nullable().optional(),
  attendeeName: z.string().max(200).nullable().optional(),
  attendeeEmail: z.string().email().nullable().optional(),
  status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
})

export const GET = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const url = new URL(request.url)
    const leadId = url.searchParams.get('leadId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: Record<string, unknown> = { organizationId }
    if (leadId) where.leadId = leadId
    if (from || to) {
      where.startTime = {}
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from)
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to)
    }

    const appointments = await db.appointment.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json({ appointments })
  })

export const POST = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const parsed = await parseJsonBody(request, createAppointmentSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const appointment = await db.appointment.create({
      data: {
        organizationId,
        title: body.title,
        description: body.description,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        timezone: body.timezone ?? 'America/New_York',
        location: body.location,
        leadId: body.leadId,
        attendeeName: body.attendeeName,
        attendeeEmail: body.attendeeEmail,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json({ appointment }, { status: 201 })
  })