import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'

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

export const GET = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params

    const appointment = await db.appointment.findFirst({
      where: { id, organizationId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    return NextResponse.json({ appointment })
  })

export const PATCH = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params
    const parsed = await parseJsonBody(request, updateAppointmentSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const existing = await db.appointment.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    const appointment = await db.appointment.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        timezone: body.timezone,
        location: body.location,
        leadId: body.leadId,
        attendeeName: body.attendeeName,
        attendeeEmail: body.attendeeEmail,
        status: body.status,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json({ appointment })
  })

export const DELETE = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params

    const existing = await db.appointment.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    await db.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  })