import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { enforceSameOrigin } from '@/lib/security'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, schema)
    if (!parsed.success) return parsed.response

    const email = parsed.data.email.trim().toLowerCase()

    const limited = enforceRateLimit(request, {
      key: `forgot-password:${email}`,
      limit: 3,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // SECURITY FIX (t_fb6ead6c — Sentinel audit): this endpoint previously
    // returned the raw password-reset token in the JSON body, enabling
    // unauthenticated account takeover, and leaked email existence via
    // token != null. The response is now byte-identical for real and unknown
    // emails, and the token NEVER appears in the HTTP response.
    if (user) {
      // Expire any existing unused tokens for this user
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date() },
      })

      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      })

      // Interim out-of-band channel (sanctioned by t_fb6ead6c requirement 3):
      // this repo has no email/SMTP delivery yet, so the token is recorded
      // server-side only — readable from the container log by an operator who
      // relays it to the user. NEVER echo it in the HTTP response. Replace
      // this with a real emailed reset link once email delivery exists, and
      // remove the token value from the log at that point.
      console.info(
        `[forgot-password] password-reset token created server-side for userId=${user.id} token=${token} expires=${expiresAt.toISOString()} — deliver out-of-band only`
      )
    }

    // Identical body regardless of whether the account exists (closes the
    // enumeration oracle). No token, no user-dependent fields.
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
