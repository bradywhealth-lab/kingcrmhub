import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const webhookSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
})

function serializeWebhook(hook: {
  id: string
  organizationId: string
  name: string
  url: string
  events: unknown
  isActive: boolean
  lastTriggeredAt: Date | null
  triggerCount: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...hook,
    events: Array.isArray(hook.events) ? hook.events : [],
  }
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const hooks = await db.webhook.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({
        webhooks: hooks.map(serializeWebhook),
      })
    })
  } catch (error) {
    console.error('Webhooks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'webhooks-create', limit: 40, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, webhookSchema)
      if (!parsed.success) return parsed.response

      const hook = await db.webhook.create({
        data: {
          organizationId: context.organizationId,
          name: parsed.data.name.trim(),
          url: parsed.data.url.trim(),
          events: parsed.data.events as Prisma.InputJsonValue,
          secret: parsed.data.secret?.trim() || null,
          isActive: parsed.data.isActive ?? true,
        },
      })

      return NextResponse.json({ webhook: serializeWebhook(hook) })
    })
  } catch (error) {
    console.error('Webhooks POST error:', error)
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'webhooks-update', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const parsed = await parseJsonBody(request, webhookSchema.partial())
      if (!parsed.success) return parsed.response

      const updateData: Prisma.WebhookUpdateManyMutationInput = {}
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim()
      if (parsed.data.url !== undefined) updateData.url = parsed.data.url.trim()
      if (parsed.data.events !== undefined) updateData.events = parsed.data.events as Prisma.InputJsonValue
      if (parsed.data.secret !== undefined) updateData.secret = parsed.data.secret?.trim() || null
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive

      const updated = await db.webhook.updateMany({
        where: { id, organizationId: context.organizationId },
        data: updateData,
      })
      if (updated.count === 0) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
      const webhook = await db.webhook.findUnique({ where: { id } })
      return NextResponse.json({ webhook: webhook ? serializeWebhook(webhook) : null })
    })
  } catch (error) {
    console.error('Webhooks PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'webhooks-delete', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const deleted = await db.webhook.deleteMany({
        where: { id, organizationId: context.organizationId },
      })
      if (deleted.count === 0) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Webhooks DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
  }
}
