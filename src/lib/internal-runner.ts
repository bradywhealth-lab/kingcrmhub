import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * Validates internal runner authorization for cron-style endpoints.
 * If INTERNAL_RUNNER_KEY is set, requests must provide it in x-internal-runner-key.
 */
export function isInternalRunnerAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.INTERNAL_RUNNER_KEY?.trim()
  if (!requiredKey) return false

  const providedKey = request.headers.get('x-internal-runner-key')?.trim()
  if (!providedKey) return false

  const requiredBuffer = Buffer.from(requiredKey)
  const providedBuffer = Buffer.from(providedKey)
  if (requiredBuffer.length !== providedBuffer.length) return false
  return timingSafeEqual(requiredBuffer, providedBuffer)
}
