import { NextRequest, NextResponse } from 'next/server'

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateEntry>()

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

function compactExpiredEntries(now: number) {
  if (buckets.size < 5000) return
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey)
  }
}

export function enforceRateLimit(request: NextRequest, options: RateLimitOptions): NextResponse | null {
  const now = Date.now()
  compactExpiredEntries(now)

  const ip = getClientIp(request)
  const bucketKey = `${options.key}:${ip}`
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return null
  }

  if (existing.count >= options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'Too many requests, please retry later' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    )
  }

  existing.count += 1
  buckets.set(bucketKey, existing)
  return null
}
