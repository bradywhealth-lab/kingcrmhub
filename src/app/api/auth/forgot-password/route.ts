import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { enforceSameOrigin } from '@/lib/security'

const schema = z.object({
  email: z.string().email(),
})

// Timing-oracle fix (cubic P2, PR #182): both the known-email and unknown-email
// paths pad to this floor before responding, so response latency carries no
// signal about whether an account exists. 250ms comfortably covers the real
// path's extra DB round trips under normal load.
const MIN_ELAPSED_MS = 250

// Sentinel user id that matches no row — lets the unknown-email path mirror the
// real path's write shape (one no-op updateMany) without touching any data.
const SENTINEL_USER_ID = '__timing_equalization_sentinel__'

/** Non-reversible short fingerprint for operator correlation in logs. */
function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

async function padToMinElapsed(startedAt: number): Promise<void> {
  const remaining = MIN_ELAPSED_MS - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

export async function POST(request: NextRequest) {
  try {
    const startedAt = Date.now()
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

      // Interim out-of-band channel (sanctioned by t_fb6ead6c requirement 3),
      // REDACTED BY DEFAULT (cubic P2, PR #182): a usable token in the log
      // stream re-opens the takeover through log drains, vendors, and anyone
      // with container-log read access — reset-password accepts the token
      // verbatim for 1h. The default log line carries only a non-reversible
      // sha256 fingerprint for operator correlation. The full token requires
      // an explicit opt-in flag that MUST be verifiably unset in the
      // production image (deploy gate: `docker exec kingcrmhub printenv
      // FORGOT_PASSWORD_LOG_FULL_TOKEN` → empty). Consequence: until real
      // email delivery exists, password reset is operator-assisted only —
      // flip the flag temporarily under change control, relay the token,
      // unset it. Remove this whole channel when email lands.
      const loggableToken =
        process.env.FORGOT_PASSWORD_LOG_FULL_TOKEN === '1' ? token : tokenFingerprint(token)
      console.info(
        `[forgot-password] password-reset token created server-side for userId=${user.id} token=${loggableToken} expires=${expiresAt.toISOString()} — deliver out-of-band only`
      )
    } else {
      // Timing equalization (cubic P2, PR #182): mirror the real path's crypto
      // + write work so latency doesn't reveal account existence. The sentinel
      // updateMany matches zero rows; the generated token is discarded.
      randomBytes(32).toString('hex')
      await db.passwordResetToken.updateMany({
        where: { userId: SENTINEL_USER_ID, usedAt: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date() },
      })
    }

    await padToMinElapsed(startedAt)

    // Identical body regardless of whether the account exists (closes the
    // enumeration oracle). No token, no user-dependent fields.
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
