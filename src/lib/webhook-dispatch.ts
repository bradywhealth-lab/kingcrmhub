import { db } from '@/lib/db'
import { createHmac } from 'node:crypto'

export async function dispatchWebhooks(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const webhooks = await db.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    })

    const matching = webhooks.filter((w) => {
      const events = Array.isArray(w.events) ? (w.events as string[]) : []
      return events.includes(event) || events.includes('*')
    })

    if (matching.length === 0) return

    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload })

    const promises = matching.map(async (webhook) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
        }

        if (webhook.secret) {
          const signature = createHmac('sha256', webhook.secret).update(body).digest('hex')
          headers['X-Webhook-Signature'] = signature
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)

        const res = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        })

        clearTimeout(timeout)

        await db.webhook.update({
          where: { id: webhook.id },
          data: {
            lastTriggeredAt: new Date(),
            triggerCount: { increment: 1 },
          },
        })

        if (!res.ok) {
          console.warn(`Webhook ${webhook.id} returned ${res.status}`)
        }
      } catch (err) {
        console.error(`Webhook ${webhook.id} dispatch failed:`, err)
      }
    })

    await Promise.allSettled(promises)
  } catch (err) {
    console.error('Webhook dispatch error:', err)
  }
}
