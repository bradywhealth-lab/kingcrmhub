/**
 * Twilio SMS Client Wrapper
 *
 * Handles sending and receiving SMS messages via Twilio.
 * Manages message threading and activity tracking.
 */

import twilio from 'twilio'

// Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER

// Message status types
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered'

// SMS send result
export interface SMSSendResult {
  success: boolean
  messageId?: string
  threadId?: string
  activityId?: string
  error?: string
  twilioSid?: string
}

// Template variable context
export interface SMSTemplateContext {
  leadName: string
  firstName?: string
  lastName?: string
  company?: string
  agentName?: string
  [key: string]: string | undefined
}

// Twilio client (lazy initialization)
type TwilioClient = ReturnType<typeof twilio>

let twilioClient: TwilioClient | null = null

/**
 * Get or initialize Twilio client
 */
function getTwilioClient(): TwilioClient | null {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('Twilio credentials not configured')
    return null
  }

  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  }

  return twilioClient
}

/**
 * Check if Twilio is configured and available
 */
export function isTwilioAvailable(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER)
}

/**
 * Send an SMS message to a lead
 *
 * @param leadId - Lead ID to send message to
 * @param body - Message body (or template name if templateId provided)
 * @param options - Additional options
 * @returns Send result with message/thread IDs
 */
export async function sendSMS(
  leadId: string,
  body: string,
  options: {
    organizationId: string
    userId?: string
    templateId?: string
    templateContext?: SMSTemplateContext
    mediaUrls?: string[]
  }
): Promise<SMSSendResult> {
  const client = getTwilioClient()

  if (!client || !TWILIO_FROM_NUMBER) {
    return {
      success: false,
      error: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.'
    }
  }

  try {
    // Import db dynamically to avoid module resolution issues
    const { db } = await import('@/lib/db')

    // Fetch lead details
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        smsOptOut: true,
        organizationId: true
      }
    })

    if (!lead) {
      return { success: false, error: 'Lead not found' }
    }

    if (!lead.phone) {
      return { success: false, error: 'Lead has no phone number' }
    }

    // Check SMS opt-out
    if (lead.smsOptOut) {
      return { success: false, error: 'Lead has opted out of SMS messages' }
    }

    if (lead.organizationId !== options.organizationId) {
      return { success: false, error: 'Lead belongs to different organization' }
    }

    // Apply template variables if context provided
    let messageBody = body
    if (options.templateContext) {
      messageBody = applyTemplateVariables(body, {
        ...options.templateContext,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'there',
        firstName: lead.firstName || '',
        lastName: lead.lastName || ''
      })
    }

    // Find or create message thread
    const thread = await findOrCreateMessageThread({
      leadId,
      organizationId: options.organizationId,
      phone: lead.phone
    })

    // Send via Twilio
    const twilioMessage = await client.messages.create({
      body: messageBody,
      from: TWILIO_FROM_NUMBER,
      to: lead.phone,
      mediaUrl: options.mediaUrls
    })

    // Create Message record
    const message = await db.message.create({
      data: {
        threadId: thread.id,
        channel: 'sms',
        direction: 'outbound',
        status: mapTwilioStatus(twilioMessage.status),
        body: messageBody,
        attachments: {
          twilioSid: twilioMessage.sid,
          ...(options.mediaUrls ? { mediaUrls: options.mediaUrls } : {}),
        },
        fromAddress: TWILIO_FROM_NUMBER,
        toAddress: lead.phone,
        sentAt: new Date(twilioMessage.dateCreated || Date.now())
      }
    })

    // Create activity record
    const activity = await db.activity.create({
      data: {
        organizationId: options.organizationId,
        userId: options.userId,
        leadId,
        type: 'sms',
        title: 'SMS sent',
        description: messageBody.substring(0, 255),
        metadata: {
          messageId: message.id,
          threadId: thread.id,
          templateId: options.templateId,
          twilioSid: twilioMessage.sid
        } as any
      }
    })

    // Update thread timestamp
    await db.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() }
    })

    return {
      success: true,
      messageId: message.id,
      threadId: thread.id,
      activityId: activity.id,
      twilioSid: twilioMessage.sid
    }
  } catch (error) {
    console.error('SMS send failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find or create a message thread for SMS
 */
async function findOrCreateMessageThread({
  leadId,
  organizationId,
  phone
}: {
  leadId: string
  organizationId: string
  phone: string
}) {
  const { db } = await import('@/lib/db')

  // Try to find existing thread
  let thread = await db.messageThread.findFirst({
    where: {
      leadId,
      primaryChannel: 'sms'
    }
  })

  if (!thread) {
    // Create new thread
    thread = await db.messageThread.create({
      data: {
        leadId,
        organizationId,
        primaryChannel: 'sms',
        participantPhone: phone,
        lastMessageAt: new Date()
      }
    })
  }

  return thread
}

/**
 * Map Twilio status to internal status
 */
function mapTwilioStatus(twilioStatus: string): MessageStatus {
  const statusMap: Record<string, MessageStatus> = {
    queued: 'pending',
    sending: 'pending',
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    undelivered: 'undelivered'
  }

  return statusMap[twilioStatus] || 'pending'
}

/**
 * Apply template variables to message body
 */
function applyTemplateVariables(template: string, context: SMSTemplateContext): string {
  let result = template

  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`
    result = result.replaceAll(placeholder, value || '')
  }

  return result
}

/**
 * Handle incoming SMS from Twilio webhook
 */
export async function handleIncomingSMS(payload: {
  From: string
  To: string
  Body: string
  MessageSid: string
  AccountSid: string
  fromCity?: string
  fromState?: string
  fromCountry?: string
}): Promise<{ success: boolean; threadId?: string; messageId?: string; error?: string }> {
  const client = getTwilioClient()

  if (!client) {
    return { success: false, error: 'Twilio not configured' }
  }

  // Validate Twilio account
  if (payload.AccountSid !== TWILIO_ACCOUNT_SID) {
    return { success: false, error: 'Invalid account' }
  }

  try {
    const { db } = await import('@/lib/db')

    // Find lead by phone number
    const phone = normalizePhoneNumber(payload.From)
    const lead = await db.lead.findFirst({
      where: {
        phone,
        organization: {
          integrations: {
            some: {
              type: 'twilio',
              isActive: true
            }
          }
        }
      },
      select: {
        id: true,
        organizationId: true,
        smsOptOut: true
      }
    })

    if (!lead) {
      // Could be from an unknown number - still create thread but don't link to lead
      return {
        success: false,
        error: 'Lead not found for this phone number'
      }
    }

    // Check for opt-out keywords
    const body = payload.Body.trim().toUpperCase()
    if (body === 'STOP' || body === 'UNSUBSCRIBE' || body === 'CANCEL') {
      await db.lead.update({
        where: { id: lead.id },
        data: { smsOptOut: true }
      })

      // Send confirmation
      await client.messages.create({
        body: 'You have opted out of SMS messages. Reply START to resubscribe.',
        from: payload.To,
        to: payload.From
      })

      return { success: true, messageId: 'opt-out-processed' }
    }

    // Check for opt-in keywords
    if (body === 'START' || body === 'SUBSCRIBE') {
      await db.lead.update({
        where: { id: lead.id },
        data: { smsOptOut: false }
      })

      return { success: true, messageId: 'opt-in-processed' }
    }

    // Find or create thread
    const thread = await findOrCreateMessageThread({
      leadId: lead.id,
      organizationId: lead.organizationId,
      phone
    })

    // Create message record
    const message = await db.message.create({
      data: {
        threadId: thread.id,
        channel: 'sms',
        direction: 'inbound',
        status: 'delivered',
        body: payload.Body,
        fromAddress: payload.From,
        toAddress: payload.To,
        sentAt: new Date()
      }
    })

    // Create activity
    await db.activity.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        type: 'sms',
        title: 'SMS received',
        description: `Received: ${payload.Body.substring(0, 100)}`,
        metadata: {
          messageId: message.id,
          threadId: thread.id,
          twilioSid: payload.MessageSid,
          fromCity: payload.fromCity,
          fromState: payload.fromState,
          fromCountry: payload.fromCountry
        } as any
      }
    })

    // Update thread
    await db.messageThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 }
      }
    })

    return {
      success: true,
      threadId: thread.id,
      messageId: message.id
    }
  } catch (error) {
    console.error('Incoming SMS handling failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Update message status from Twilio webhook callback
 */
export async function updateMessageStatus(payload: {
  MessageSid: string
  MessageStatus: string
  ErrorCode?: string
  ErrorMessage?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await import('@/lib/db')

    // Find message by Twilio SID
    const message = await db.message.findFirst({
      where: {
        channel: 'sms',
        attachments: {
          path: ['twilioSid'],
          equals: payload.MessageSid
        }
      },
      include: {
        thread: {
          include: {
            lead: true
          }
        }
      }
    })

    if (!message) {
      return { success: false, error: 'Message not found' }
    }

    // Update status
    await db.message.update({
      where: { id: message.id },
      data: {
        status: mapTwilioStatus(payload.MessageStatus),
        ...(payload.MessageStatus === 'delivered' && { deliveredAt: new Date() }),
        ...(payload.MessageStatus === 'read' && { readAt: new Date() })
      }
    })

    // If failed, create activity
    if (payload.MessageStatus === 'failed' || payload.MessageStatus === 'undelivered') {
      await db.activity.create({
        data: {
          organizationId: message.thread.organizationId,
          leadId: message.thread.lead?.id,
          type: 'system',
          title: 'SMS delivery failed',
          description: payload.ErrorMessage || `Error code: ${payload.ErrorCode}`,
          metadata: {
            messageId: message.id,
            twilioSid: payload.MessageSid,
            errorCode: payload.ErrorCode
          } as any
        }
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Status update failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Normalize phone number for comparison
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  return phone.replace(/\D/g, '')
}
