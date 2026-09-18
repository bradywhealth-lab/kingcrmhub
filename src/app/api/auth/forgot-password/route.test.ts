import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
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
// Must match the sentinel id in route.ts (timing-equalization no-op write).
const SENTINEL_USER_ID = '__timing_equalization_sentinel__'

function postForgotPassword(email: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

describe('/api/auth/forgot-password — token disclosure + enumeration oracle (security regression, t_fb6ead6c)', () => {
  let infoSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.passwordResetToken.updateMany.mockResolvedValue({ count: 0 })
    mockDb.passwordResetToken.create.mockResolvedValue({ id: 'prt_1' })
    // Stub console.info for EVERY test (cubic P3, PR #182): without this the
    // real-email tests print the route's server-side log line — the live
    // 1h-valid reset token (or its fingerprint) — into CI stdout.
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.FORGOT_PASSWORD_LOG_FULL_TOKEN
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
    // Falsifiable expiry-window assertion (cubic P3, PR #182): the previous
    // `> Date.now()` check could never fail. Pin the documented 1h window.
    const expiry = created.data.expiresAt.getTime()
    expect(expiry).toBeGreaterThan(Date.now() + 55 * 60 * 1000)
    expect(expiry).toBeLessThan(Date.now() + 65 * 60 * 1000)
  })

  it('creates no usable reset token for unknown emails (only the harmless sentinel timing write)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    await POST(postForgotPassword(FAKE_EMAIL))

    // No token row is ever created for an unknown email — nothing spendable.
    expect(mockDb.passwordResetToken.create).not.toHaveBeenCalled()
    // The only write is the timing-equalization sentinel updateMany (cubic P2
    // fix): scoped to a userId that matches no row, so it touches no real data.
    expect(mockDb.passwordResetToken.updateMany).toHaveBeenCalledOnce()
    const call = mockDb.passwordResetToken.updateMany.mock.calls[0][0] as {
      where: { userId: string }
    }
    expect(call.where.userId).toBe(SENTINEL_USER_ID)
  })

  it('NEVER logs the raw token by default — only a short non-reversible fingerprint (log-redaction regression)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })

    const response = await POST(postForgotPassword(REAL_EMAIL))
    const raw = await response.text()
    const created = mockDb.passwordResetToken.create.mock.calls[0][0] as { data: { token: string } }

    const logged = infoSpy.mock.calls.map((call) => String(call[0])).join('\n')
    // The usable token must NOT appear in the default log stream (cubic P2:
    // log drains/vendors/operators could spend it exactly like the API leak).
    expect(logged).not.toContain(created.data.token)
    // The token= field carries exactly an 8-hex fingerprint — the negative
    // lookahead makes this falsifiable: a leaked full 64-hex token would
    // match the first 8 chars but fail the boundary, turning this RED.
    // (Deliberately no sha256 computed over the token here: CodeQL
    // js/insufficient-password-hash treats passwordResetToken-derived values
    // as passwords; the route's fingerprint helper is the hashed path.)
    expect(logged).toMatch(/token=[0-9a-f]{8}(?![0-9a-f])/)
    // No 64-hex secret anywhere in the log either.
    expect(logged).not.toMatch(/[0-9a-f]{64}/)
    // …and it stays absent from the response body.
    expect(raw).not.toContain(created.data.token)
  })

  it('logs the full token ONLY under the explicit FORGOT_PASSWORD_LOG_FULL_TOKEN=1 opt-in', async () => {
    process.env.FORGOT_PASSWORD_LOG_FULL_TOKEN = '1'
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'user_1', email: REAL_EMAIL })

    await POST(postForgotPassword(REAL_EMAIL))
    const created = mockDb.passwordResetToken.create.mock.calls[0][0] as { data: { token: string } }

    const logged = infoSpy.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain(created.data.token)
  })

  it('pads the unknown-email path to the response-time floor (timing-oracle equalization)', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    const startedAt = Date.now()
    await POST(postForgotPassword(FAKE_EMAIL))
    const elapsed = Date.now() - startedAt

    // Falsifiable: without the pad the mocked path returns in single-digit ms.
    // The floor (250ms) must be hit so real vs unknown latency is equalized.
    expect(elapsed).toBeGreaterThanOrEqual(250)
  })
})
