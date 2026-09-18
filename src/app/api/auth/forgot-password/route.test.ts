import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  passwordResetToken: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { POST } from './route'

const REAL_EMAIL = 'real-user@example.com'
const FAKE_EMAIL = 'nobody-9f3k2@example.invalid'
const HEX64 = /^[0-9a-f]{64}$/

function postForgotPassword(email: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

describe('/api/auth/forgot-password — token disclosure + enumeration oracle (security regression, t_fb6ead6c)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.passwordResetToken.updateMany.mockResolvedValue({ count: 0 })
    mockDb.passwordResetToken.create.mockResolvedValue({ id: 'prt_1' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('NEVER returns a "token" field for a REAL account email (no raw token disclosure)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })

    const response = await POST(postForgotPassword(REAL_EMAIL))
    const raw = await response.text()
    const json = JSON.parse(raw)

    expect(response.status).toBe(200)
    expect(json).not.toHaveProperty('token')
    // Belt and braces: the stored token value must not appear anywhere in the body.
    const created = mockDb.passwordResetToken.create.mock.calls[0][0] as { data: { token: string } }
    expect(HEX64.test(created.data.token)).toBe(true)
    expect(raw).not.toContain(created.data.token)
    // No 64-hex-like string anywhere in the response body.
    expect(raw).not.toMatch(/[0-9a-f]{64}/)
    expect(raw).toBe('{"success":true}')
  })

  it('NEVER returns a "token" field for a FAKE account email', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    const response = await POST(postForgotPassword(FAKE_EMAIL))
    const raw = await response.text()
    const json = JSON.parse(raw)

    expect(response.status).toBe(200)
    expect(json).not.toHaveProperty('token')
    expect(raw).not.toMatch(/[0-9a-f]{64}/)
    expect(raw).toBe('{"success":true}')
  })

  it('returns byte-identical bodies for real vs fake emails (enumeration oracle closed)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })
    const realResponse = await POST(postForgotPassword(REAL_EMAIL))
    const realRaw = await realResponse.text()

    mockDb.user.findUnique.mockResolvedValueOnce(null)
    const fakeResponse = await POST(postForgotPassword(FAKE_EMAIL))
    const fakeRaw = await fakeResponse.text()

    expect(realRaw).toBe(fakeRaw)
    expect(realResponse.status).toBe(fakeResponse.status)
  })

  it('still creates a working server-side reset token for real accounts (flow not broken)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })

    await POST(postForgotPassword(REAL_EMAIL))

    expect(mockDb.passwordResetToken.updateMany).toHaveBeenCalledOnce()
    expect(mockDb.passwordResetToken.create).toHaveBeenCalledOnce()
    const created = mockDb.passwordResetToken.create.mock.calls[0][0] as {
      data: { userId: string; token: string; expiresAt: Date }
    }
    expect(created.data.userId).toBe('user_1')
    expect(HEX64.test(created.data.token)).toBe(true)
    expect(created.data.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('creates no reset token for unknown emails (no side effects beyond the lookup)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    await POST(postForgotPassword(FAKE_EMAIL))

    expect(mockDb.passwordResetToken.create).not.toHaveBeenCalled()
    expect(mockDb.passwordResetToken.updateMany).not.toHaveBeenCalled()
  })

  it('logs the token server-side only — never in the HTTP response (interim out-of-band channel)', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })

    const response = await POST(postForgotPassword(REAL_EMAIL))
    const raw = await response.text()
    const created = mockDb.passwordResetToken.create.mock.calls[0][0] as { data: { token: string } }

    // Token is present in the server-side log (operator-relayable)…
    const logged = infoSpy.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain(created.data.token)
    // …and absent from the response body.
    expect(raw).not.toContain(created.data.token)
  })
})
