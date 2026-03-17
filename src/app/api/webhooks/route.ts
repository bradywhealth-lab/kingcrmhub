import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const VALID_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.status_changed',
  'lead.score_changed',
  'pipeline.item_moved',
  'pipeline.deal_won',
  'pipeline.deal_lost',
  'activity.created',
  'booking.created',
  'upload.completed',
  'sequence.enrolled',
  'content.published',
] as const

const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().max(200).optional(),
})

const updateWebhookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const webhooks = await db.webhook.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ webhooks, availableEvents: VALID_EVENTS })
    })
  } catch (error) {
    console.error('Webhooks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'webhooks-create', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createWebhookSchema)
      if (!parsed.success) return parsed.response

      const { name, url, events, secret } = parsed.data
      const webhook = await db.webhook.create({
        data: {
          organizationId: context.organizationId,
          name: name.trim(),
          url: url.trim(),
          events: events.filter((e) => (VALID_EVENTS as readonly string[]).includes(e)),
          secret: secret || null,
          isActive: true,
        },
      })
      return NextResponse.json({ webhook })
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
    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, updateWebhookSchema)
      if (!parsed.success) return parsed.response

      const { id, ...updates } = parsed.data
      const existing = await db.webhook.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

      const data: Record<string, unknown> = {}
      if (updates.name !== undefined) data.name = updates.name.trim()
      if (updates.url !== undefined) data.url = updates.url.trim()
      if (updates.events !== undefined) data.events = updates.events.filter((e) => (VALID_EVENTS as readonly string[]).includes(e))
      if (updates.isActive !== undefined) data.isActive = updates.isActive

      const webhook = await db.webhook.update({ where: { id }, data })
      return NextResponse.json({ webhook })
    })
  } catch (error) {
    console.error('Webhooks PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'webhooks-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    return await withRequestOrgContext(request, async (context) => {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const existing = await db.webhook.findFirst({
        where: { id, organizationId: context.organizationId },
      })
      if (!existing) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

      await db.webhook.delete({ where: { id } })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Webhooks DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
  }
}
