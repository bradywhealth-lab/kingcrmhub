import { NextRequest } from 'next/server'

/**
 * Validates internal runner authorization for cron-style endpoints.
 * If INTERNAL_RUNNER_KEY is set, requests must provide it in x-internal-runner-key.
 */
export function isInternalRunnerAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.INTERNAL_RUNNER_KEY

  // Backward-compatible local mode when no key is configured yet.
  if (!requiredKey) return true

  const providedKey = request.headers.get('x-internal-runner-key')
  return typeof providedKey === 'string' && providedKey.length > 0 && providedKey === requiredKey
}
