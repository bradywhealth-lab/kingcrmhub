import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, enforceSameOrigin } from '@/lib/security'
import { hashSessionToken } from '@/lib/auth'

describe('security helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv })
  })

  it('hashes session tokens deterministically', () => {
    expect(hashSessionToken('token_123')).toBe(hashSessionToken('token_123'))
    expect(hashSessionToken('token_123')).not.toBe('token_123')
  })

  it('rejects cross-site unsafe requests', async () => {
    const request = new NextRequest('https://crm.example/api/auth', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
      },
    })

    const response = enforceSameOrigin(request)

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual(expect.objectContaining({ error: 'Cross-site request blocked' }))
  })

  it('allows local same-origin posts in development even when APP_BASE_URL points elsewhere', () => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      APP_BASE_URL: 'https://insurafuze-king-crm.vercel.app',
    })

    const request = new NextRequest('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
      },
    })

    const response = enforceSameOrigin(request)

    expect(response).toBeNull()
  })

  it('adds hardening headers to responses', () => {
    const request = new NextRequest('https://crm.example/api/leads')
    const response = applySecurityHeaders(request, NextResponse.next())

    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0')
  })
})
