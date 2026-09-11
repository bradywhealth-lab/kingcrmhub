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

export const GET = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const url = new URL(request.url)
    const leadId = url.searchParams.get('leadId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: Record<string, unknown> = { organizationId }
    if (leadId) where.leadId = leadId
    if (from || to) {
      // Strict ISO 8601 date validation — reject calendar-invalid dates like 2024-02-31
      const isoDateRe = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/
      if ((from && !isoDateRe.test(from)) || (to && !isoDateRe.test(to))) {
        return NextResponse.json({ error: 'Invalid date format for from/to parameter' }, { status: 400 })
      }
      const gte = from ? new Date(from) : undefined
      const lte = to ? new Date(to) : undefined
      if ((from && isNaN(gte!.getTime())) || (to && isNaN(lte!.getTime()))) {
        return NextResponse.json({ error: 'Invalid date format for from/to parameter' }, { status: 400 })
      }
      where.startTime = {}
      if (gte) (where.startTime as Record<string, unknown>).gte = gte
      if (lte) (where.startTime as Record<string, unknown>).lte = lte
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

    // Validate interval: end must be after start
    const start = new Date(body.startTime)
    const end = new Date(body.endTime)
    if (end <= start) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Scope leadId to this organization
    if (body.leadId) {
      const lead = await db.lead.findFirst({ where: { id: body.leadId, organizationId }, select: { id: true } })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const appointment = await db.appointment.create({
      data: {
        organizationId,
        title: body.title,
        description: body.description,
        startTime: start,
        endTime: end,
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