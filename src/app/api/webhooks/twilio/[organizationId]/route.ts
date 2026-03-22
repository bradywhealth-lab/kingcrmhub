import { NextRequest, NextResponse } from 'next/server'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { getTwilioConfigForOrganization, normalizePhone, verifyTwilioSignature } from '@/lib/twilio'

type Params = { params: Promise<{ organizationId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params
    const config = await getTwilioConfigForOrganization(organizationId)
    if (!config) {
      return NextResponse.json({ error: 'Twilio integration not configured' }, { status: 404 })
    }

    const formData = await request.formData()
    const bodyParams = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      bodyParams.append(key, String(value))
    }

    const valid = verifyTwilioSignature({
      authToken: config.authToken,
      url: request.url,
      params: bodyParams,
      signature: request.headers.get('x-twilio-signature'),
    })
    if (!valid) {
      return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 })
    }

    return withOrgRlsTransaction(organizationId, async () => {
      const messageId = request.nextUrl.searchParams.get('messageId')
      const threadId = request.nextUrl.searchParams.get('threadId')
      const messageStatus = bodyParams.get('MessageStatus')
      const messageSid = bodyParams.get('MessageSid')
      const from = bodyParams.get('From')
      const to = bodyParams.get('To')
      const body = bodyParams.get('Body') || ''

      if (messageId && threadId && messageStatus) {
        await db.message.updateMany({
          where: { id: messageId, threadId },
          data: {
            status: normalizeTwilioStatus(messageStatus),
            sentAt: ['queued', 'accepted', 'sending', 'sent'].includes(messageStatus) ? new Date() : undefined,
            deliveredAt: ['delivered'].includes(messageStatus) ? new Date() : undefined,
            readAt: ['read'].includes(messageStatus) ? new Date() : undefined,
          },
        })

        await db.activity.create({
          data: {
            organizationId,
            type: 'sms_status',
            title: `SMS ${normalizeTwilioStatus(messageStatus)}`,
            description: messageSid || messageId,
            metadata: {
              messageId,
              threadId,
              messageSid,
              messageStatus,
            },
          },
        })

        return NextResponse.json({ ok: true, mode: 'status' })
      }

      if (from && to) {
        const normalizedFrom = normalizePhone(from)

        const lead = await db.lead.findFirst({
          where: {
            organizationId,
            OR: [
              { phone: from },
              { phone: normalizedFrom },
            ],
          },
        })

        let thread = await db.messageThread.findFirst({
          where: {
            organizationId,
            primaryChannel: 'sms',
            participantPhone: from,
          },
        })

        if (!thread) {
          thread = await db.messageThread.create({
            data: {
              organizationId,
              leadId: lead?.id,
              primaryChannel: 'sms',
              participantPhone: from,
            },
          })
        }

        const message = await db.message.create({
          data: {
            threadId: thread.id,
            channel: 'sms',
            direction: 'inbound',
            status: 'delivered',
            body,
            fromAddress: from,
            toAddress: to,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        })

        await db.messageThread.update({
          where: { id: thread.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            leadId: lead?.id ?? thread.leadId ?? undefined,
          },
        })

        await db.activity.create({
          data: {
            organizationId,
            leadId: lead?.id,
            type: 'sms',
            title: 'Inbound SMS received',
            description: body.slice(0, 120),
            metadata: {
              threadId: thread.id,
              messageId: message.id,
              messageSid,
              from,
            },
          },
        })

        if (lead?.id) {
          await db.lead.update({
            where: { id: lead.id },
            data: { lastRespondedAt: new Date() },
          })
        }

        return NextResponse.json({ ok: true, mode: 'inbound' })
      }

      return NextResponse.json({ ok: true, mode: 'noop' })
    })
  } catch (error) {
    console.error('Twilio webhook error:', error)
    return NextResponse.json({ error: 'Failed to process Twilio webhook' }, { status: 500 })
  }
}

function normalizeTwilioStatus(status: string) {
  if (['queued', 'accepted', 'scheduled'].includes(status)) return 'pending'
  if (['sending', 'sent'].includes(status)) return 'sent'
  if (status === 'delivered') return 'delivered'
  if (status === 'read') return 'read'
  if (['failed', 'undelivered', 'canceled'].includes(status)) return 'failed'
  return status
}
