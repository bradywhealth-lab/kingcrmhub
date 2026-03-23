/**
 * POST /api/sms/send
 *
 * Send an SMS message to a lead.
 * Creates Message, MessageThread, and Activity records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendSMS } from '@/lib/sms'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'

// Validation schema
const sendSMSSchema = z.object({
  leadId: z.string().cuid(),
  body: z.string().min(1).max(1600),
  templateId: z.string().cuid().optional(),
  templateContext: z.record(z.string(), z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional()
})

export async function POST(request: NextRequest) {
  return withRequestOrgContext(request, async ({ organizationId, userId }) => {
    try {
      const limited = enforceRateLimit(request, {
        key: 'sms-send',
        limit: 5,
        windowMs: 60_000,
        identifier: organizationId,
      })
      if (limited) return limited

      // Parse and validate request body
      const body = await request.json()
      const validatedData = sendSMSSchema.parse(body)

      // Send SMS
      const result = await sendSMS(validatedData.leadId, validatedData.body, {
        organizationId,
        userId: userId ?? undefined,
        templateId: validatedData.templateId,
        templateContext: validatedData.templateContext as any,
        mediaUrls: validatedData.mediaUrls
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        threadId: result.threadId,
        activityId: result.activityId
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.issues },
          { status: 400 }
        )
      }

      console.error('SMS send error:', error)
      return NextResponse.json(
        { error: 'Failed to send SMS' },
        { status: 500 }
      )
    }
  })
}
