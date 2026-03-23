import { NextRequest, NextResponse } from 'next/server'

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
  identifier?: string
}

type RateEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateEntry>()

/** Whether forwarded headers are set by a trusted proxy (e.g. Vercel), not by the client. */
function isTrustedProxy(): boolean {
  return process.env.VERCEL === '1' || process.env.TRUST_PROXY === '1'
}

/** Basic validation: allow IPv4, IPv6, or localhost. Reject anything that looks like injection. */
function isValidIpCandidate(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 45) return false
  // IPv4, IPv6, or hostnames like "localhost" / "::1"
  return /^[\d.:a-fA-F]+$/.test(trimmed) || trimmed === 'localhost'
}

function getClientIp(request: NextRequest): string {
  if (!isTrustedProxy()) {
    // Do not use client-controlled headers; one bucket for all unidentifiable clients.
    return 'anonymous'
  }
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0].trim()
    if (isValidIpCandidate(first)) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp && isValidIpCandidate(realIp.trim())) return realIp.trim()
  return 'unknown'
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

  const bucketIdentity = options.identifier?.trim() || getClientIp(request)
  const bucketKey = `${options.key}:${bucketIdentity}`
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
