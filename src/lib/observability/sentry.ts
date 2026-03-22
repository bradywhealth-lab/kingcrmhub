let initialized = false

export function initSentry() {
  if (initialized) return
  initialized = true

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return

  if (process.env.NODE_ENV !== 'production') {
    console.info('[observability] NEXT_PUBLIC_SENTRY_DSN detected; Sentry stub initialized.')
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) return
  console.error('[observability] Captured exception via Sentry stub.', {
    error,
    ...context,
  })
}
