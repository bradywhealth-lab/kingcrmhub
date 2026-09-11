import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  leadId: z.string().optional(),
  pipelineItemId: z.string().optional(),
  source: z.enum(['manual', 'auto_spawn']).optional(),
  autoSpawnRuleId: z.string().optional(),
})

export const GET = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const assignedToId = url.searchParams.get('assignedToId')
    const leadId = url.searchParams.get('leadId')
    const dueBefore = url.searchParams.get('dueBefore')

    const where: Record<string, unknown> = { organizationId }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedToId) where.assignedToId = assignedToId
    if (leadId) where.leadId = leadId
    if (dueBefore) where.dueDate = { lte: new Date(dueBefore) }

    const tasks = await db.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
        pipelineItem: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ tasks })
  })

export const POST = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const parsed = await parseJsonBody(request, createTaskSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    // Validate relation IDs belong to this org
    if (body.assignedToId) {
      const user = await db.user.findFirst({ where: { id: body.assignedToId, organizationId }, select: { id: true } })
      if (!user) return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
    }
    if (body.leadId) {
      const lead = await db.lead.findFirst({ where: { id: body.leadId, organizationId }, select: { id: true } })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    if (body.pipelineItemId) {
      const item = await db.pipelineItem.findFirst({ where: { id: body.pipelineItemId }, include: { pipeline: { select: { organizationId: true } } } })
      if (!item || item.pipeline.organizationId !== organizationId) return NextResponse.json({ error: 'Pipeline item not found' }, { status: 404 })
    }

    const task = await db.task.create({
      data: {
        organizationId,
        title: body.title,
        description: body.description,
        status: body.status ?? 'todo',
        priority: body.priority ?? 'normal',
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedToId: body.assignedToId,
        leadId: body.leadId,
        pipelineItemId: body.pipelineItemId,
        source: body.source ?? 'manual',
        autoSpawnRuleId: body.autoSpawnRuleId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  })