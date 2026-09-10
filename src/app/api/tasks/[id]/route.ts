import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  position: z.number().int().optional(),
})

export const GET = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params

    const task = await db.task.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
        pipelineItem: { select: { id: true, title: true, stageId: true } },
      },
    })

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ task })
  })

export const PATCH = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params
    const parsed = await parseJsonBody(request, updateTaskSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const existing = await db.task.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // Auto-set completedAt when moving to done
    const completedAt =
      body.status === 'done' && existing.status !== 'done'
        ? new Date()
        : body.completedAt !== undefined
          ? (body.completedAt ? new Date(body.completedAt) : null)
          : existing.completedAt

    const task = await db.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
        completedAt,
        assignedToId: body.assignedToId,
        position: body.position,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json({ task })
  })

export const DELETE = (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const { id } = await params

    const existing = await db.task.findFirst({ where: { id, organizationId } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    await db.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  })