import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  trigger: z.string().min(1).max(100),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).min(1),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const automations = await db.automation.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
      })

      const stats = {
        active: automations.filter((a) => a.isActive).length,
        totalRuns: automations.reduce((s, a) => s + a.executionCount, 0),
        total: automations.length,
      }

      return NextResponse.json({ automations, stats })
    })
  } catch (error) {
    console.error('Automations GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-create', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createAutomationSchema)
      if (!parsed.success) return parsed.response

      const data = parsed.data
      const automation = await db.automation.create({
        data: {
          organizationId: context.organizationId,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          trigger: data.trigger,
          triggerConfig: data.triggerConfig || null,
          conditions: data.conditions || null,
          actions: data.actions,
          isActive: data.isActive ?? true,
        },
      })
      return NextResponse.json({ automation })
    })
  } catch (error) {
    console.error('Automations POST error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-update', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const existing = await db.automation.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

      const body = await request.json()
      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = String(body.name).trim()
      if (body.description !== undefined) data.description = body.description || null
      if (body.isActive !== undefined) data.isActive = !!body.isActive
      if (body.trigger !== undefined) data.trigger = body.trigger
      if (body.actions !== undefined) data.actions = body.actions

      const updated = await db.automation.update({ where: { id }, data })
      return NextResponse.json({ automation: updated })
    })
  } catch (error) {
    console.error('Automations PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const existing = await db.automation.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

      await db.automation.delete({ where: { id } })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Automations DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
