/**
 * POST /api/webhooks/twilio
 *
 * Handle Twilio webhooks for:
 * - Incoming SMS messages
 * - Delivery status callbacks
 *
 * This endpoint does not require authentication (Twilio can't sign requests the same way).
 * Instead, we validate the AccountSid matches our configured account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingSMS, updateMessageStatus } from '@/lib/sms'
import twilio from 'twilio'

async function parseFormData(request: NextRequest): Promise<{ data: Record<string, string>; params: URLSearchParams }> {
  const text = await request.text()
  const params = new URLSearchParams(text)
  const result: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    result[key] = value
  }

  return { data: result, params }
}

export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
    if (!authToken) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    }

    const signature = request.headers.get('x-twilio-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 })
    }

    const { data, params } = await parseFormData(request)
    const valid = twilio.validateRequest(authToken, signature, request.url, Object.fromEntries(params))
    if (!valid) {
      return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 })
    }

    // Determine webhook type based on presence of certain fields
    // MessageSid + MessageStatus = status callback
    // From + To + Body = incoming message
    const isStatusCallback = data.MessageStatus !== undefined

    if (isStatusCallback) {
      // Handle delivery status update
      const result = await updateMessageStatus({
        MessageSid: data.MessageSid,
        MessageStatus: data.MessageStatus,
        ErrorCode: data.ErrorCode,
        ErrorMessage: data.ErrorMessage
      })

      if (!result.success) {
        console.error('Status update failed:', result.error)
      }

      // Always return 200 to Twilio (they don't retry on 200)
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    // Handle incoming SMS
    if (data.From && data.To && data.Body) {
      const result = await handleIncomingSMS({
        From: data.From,
        To: data.To,
        Body: data.Body,
        MessageSid: data.MessageSid,
        AccountSid: data.AccountSid,
        fromCity: data.FromCity,
        fromState: data.FromState,
        fromCountry: data.FromCountry
      })

      if (!result.success) {
        console.error('Incoming SMS handling failed:', result.error)
      }

      // Return empty TwiML response
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    // Unknown webhook type
    console.error('Unknown Twilio webhook:', data)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })
  } catch (error) {
    console.error('Twilio webhook error:', error)
    // Always return 200 to Twilio to prevent retries
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })
  }
}
