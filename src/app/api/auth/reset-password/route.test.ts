import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  passwordResetToken: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  userSession: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(() => 'hashed-password'),
}))

import { POST } from './route'
import { hashPassword } from '@/lib/auth'

// The single generic message every failure branch must return (t_fb6ead6c
// finding 6 — Atlas): token-state differences must never reach the client.
const GENERIC_TOKEN_ERROR = 'This reset link is invalid or has expired.'

function postResetPassword(token: string, password = 'new-password-123'): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
}

describe('/api/auth/reset-password — token-state oracle closed (security regression, t_fb6ead6c finding 6)', () => {
  let infoSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the SAME generic 400 for an unknown token, a used token, and an expired token (no state oracle)', async () => {
    const hour = 60 * 60 * 1000

    // 1. Token never existed
    mockDb.passwordResetToken.findUnique.mockResolvedValueOnce(null)
    const unknownRes = await POST(postResetPassword('a'.repeat(64)))
    const unknownBody = await unknownRes.text()

    // 2. Token exists but was already spent
    mockDb.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt_1',
      userId: 'user_1',
      usedAt: new Date(Date.now() - hour),
      expiresAt: new Date(Date.now() + hour),
    })
    const usedRes = await POST(postResetPassword('b'.repeat(64)))
    const usedBody = await usedRes.text()

    // 3. Token exists, unused, but expired
    mockDb.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt_2',
      userId: 'user_1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    })
    const expiredRes = await POST(postResetPassword('c'.repeat(64)))
    const expiredBody = await expiredRes.text()

    // All three states must be indistinguishable to the caller…
    expect(unknownRes.status).toBe(400)
    expect(usedRes.status).toBe(400)
    expect(expiredRes.status).toBe(400)
    expect(unknownBody).toBe(usedBody)
    expect(usedBody).toBe(expiredBody)
    expect(JSON.parse(unknownBody)).toEqual({ error: GENERIC_TOKEN_ERROR })

    // …and none of the pre-fix distinguishing strings may leak back.
    // (The NEW generic message legitimately contains "has expired" — the
    // oracle was the token-specific wording, asserted in full below.)
    for (const body of [unknownBody, usedBody, expiredBody]) {
      expect(body).not.toContain('already been used')
      expect(body).not.toContain('This reset token has expired')
      expect(body).not.toContain('Invalid or expired reset token')
    }
  })

  it('keeps the specific rejection reason server-side only (logs, never the token value)', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValueOnce(null)

    await POST(postResetPassword('a'.repeat(64)))

    const logged = infoSpy.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain('[reset-password] rejected: token not found')
    // The probed token itself must never be logged either.
    expect(logged).not.toContain('a'.repeat(64))
  })

  it('still resets the password and invalidates sessions for a valid unused token (flow not broken)', async () => {
    const hour = 60 * 60 * 1000
    const SUBMITTED_PASSWORD = 'new-password-123'
    mockDb.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'prt_3',
      userId: 'user_3',
      usedAt: null,
      expiresAt: new Date(Date.now() + hour),
      user: { id: 'user_3' },
    })
    const tx = {
      user: { update: vi.fn() },
      passwordResetToken: { update: vi.fn() },
      userSession: { updateMany: vi.fn() },
    }
    mockDb.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => Promise<void>) => {
      await fn(tx)
    })

    const before = Date.now()
    const response = await POST(postResetPassword('d'.repeat(64), SUBMITTED_PASSWORD))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toBe('{"success":true}')
    expect(mockDb.$transaction).toHaveBeenCalledOnce()

    // cubic P2 (PR #182 round 2): assert the DATA payloads, not just `where`,
    // so a regression that skips persisting the hash / marking the token used /
    // deactivating sessions would actually fail here.
    // 1. The submitted password is what gets hashed (mock returns 'hashed-password').
    expect(hashPassword).toHaveBeenCalledWith(SUBMITTED_PASSWORD)
    // 2. New password hash is actually persisted to the user row.
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_3' },
        data: { passwordHash: 'hashed-password' },
      }),
    )
    // 3. The token is marked used (single-use enforcement), with a real timestamp.
    const markUsedArg = tx.passwordResetToken.update.mock.calls[0][0] as {
      where: { id: string }
      data: { usedAt: Date }
    }
    expect(markUsedArg.where).toEqual({ id: 'prt_3' })
    expect(markUsedArg.data.usedAt).toBeInstanceOf(Date)
    expect(markUsedArg.data.usedAt.getTime()).toBeGreaterThanOrEqual(before)
    // 4. Active sessions are deactivated (session invalidation on reset).
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_3', isActive: true },
        data: { isActive: false },
      }),
    )
  })
})
