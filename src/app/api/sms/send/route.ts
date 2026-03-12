import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'

/**
 * POST /api/sms/send
 * Elite texting: send SMS to a lead. Wire Twilio in Settings → Integrations (type: twilio).
 * Creates Message + MessageThread; stores outbound; returns message id.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = context.organizationId
    const body = await request.json()
    const { leadId, templateId, body: messageBody, mediaUrl } = body as {
      leadId: string
      templateId?: string
      body?: string
      mediaUrl?: string
    }

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId },
    })
    if (!lead?.phone) {
      return NextResponse.json(
        { error: 'Lead not found or has no phone number' },
        { status: 404 }
      )
    }

    let content = messageBody
    if (templateId && !content) {
      const template = await db.template.findFirst({
        where: { id: templateId, organizationId, type: 'sms' },
      })
      if (template) content = template.content
    }
    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message body or valid templateId required' },
        { status: 400 }
      )
    }

    // TODO: Get Twilio credentials from Integration (type: twilio), send via Twilio API.
    // For now: persist message and thread only (no actual send).
    let thread = await db.messageThread.findFirst({
      where: { organizationId, leadId, primaryChannel: 'sms' },
    })
    if (!thread) {
      thread = await db.messageThread.create({
        data: {
          organizationId,
          leadId,
          primaryChannel: 'sms',
          participantPhone: lead.phone,
        },
      })
    }

    const message = await db.message.create({
      data: {
        threadId: thread.id,
        channel: 'sms',
        direction: 'outbound',
        status: 'pending', // → sent when Twilio confirms
        body: content,
        toAddress: lead.phone,
        fromAddress: null, // set from Twilio config
      },
    })

    await db.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    })

    await db.activity.create({
      data: {
        organizationId,
        leadId,
        type: 'sms',
        title: 'SMS sent',
        description: content.slice(0, 100) + (content.length > 100 ? '…' : ''),
        metadata: { messageId: message.id },
      },
    })

    return NextResponse.json({
      messageId: message.id,
      threadId: thread.id,
      status: 'pending',
      message: 'Message recorded. Connect Twilio in Settings → Integrations to send live SMS.',
    })
  } catch (error) {
    console.error('SMS send error:', error)
    return NextResponse.json(
      { error: 'Failed to send SMS', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
