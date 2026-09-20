import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { z } from 'zod'

const automationSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  trigger: z.string().min(1).max(80),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).min(1),
  isActive: z.boolean().optional(),
})

const automationPatchSchema = automationSchema.partial()

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const automations = await db.automation.findMany({
        where: { organizationId: context.organizationId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      })

      return NextResponse.json({
        automations: automations.map((automation) => ({
          ...automation,
          triggerConfig:
            automation.triggerConfig && typeof automation.triggerConfig === 'object' && !Array.isArray(automation.triggerConfig)
              ? automation.triggerConfig
              : null,
          conditions:
            automation.conditions && typeof automation.conditions === 'object' && !Array.isArray(automation.conditions)
              ? automation.conditions
              : null,
          actions: Array.isArray(automation.actions) ? automation.actions : [],
        })),
      })
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
      const parsed = await parseJsonBody(request, automationSchema)
      if (!parsed.success) return parsed.response

      const automation = await db.automation.create({
        data: {
          organizationId: context.organizationId,
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          trigger: parsed.data.trigger.trim(),
          triggerConfig: parsed.data.triggerConfig as Prisma.InputJsonValue | undefined,
          conditions: parsed.data.conditions as Prisma.InputJsonValue | undefined,
          actions: parsed.data.actions as Prisma.InputJsonValue,
          isActive: parsed.data.isActive ?? true,
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
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const parsed = await parseJsonBody(request, automationPatchSchema)
      if (!parsed.success) return parsed.response

      const data: Prisma.AutomationUpdateManyMutationInput = {}
      if (parsed.data.name !== undefined) data.name = parsed.data.name.trim()
      if (parsed.data.description !== undefined) data.description = parsed.data.description?.trim() || null
      if (parsed.data.trigger !== undefined) data.trigger = parsed.data.trigger.trim()
      if (parsed.data.triggerConfig !== undefined) data.triggerConfig = parsed.data.triggerConfig as Prisma.InputJsonValue
      if (parsed.data.conditions !== undefined) data.conditions = parsed.data.conditions as Prisma.InputJsonValue
      if (parsed.data.actions !== undefined) data.actions = parsed.data.actions as Prisma.InputJsonValue
      if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive

      const updated = await db.automation.updateMany({
        where: { id, organizationId: context.organizationId },
        data,
      })

      if (updated.count === 0) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
      }

      const automation = await db.automation.findUnique({ where: { id } })
      return NextResponse.json({ automation })
    })
  } catch (error) {
    console.error('Automations PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'automations-delete', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return await withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const deleted = await db.automation.deleteMany({
        where: { id, organizationId: context.organizationId },
      })

      if (deleted.count === 0) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Automations DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
