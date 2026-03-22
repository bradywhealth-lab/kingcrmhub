import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hashSessionToken } from '@/lib/security'

const mockDb = vi.hoisted(() => ({
  userSession: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withOrgRlsTransaction: vi.fn(async (_organizationId: string, callback: () => Promise<unknown>) => callback()),
  withSessionTokenRlsTransaction: vi.fn(async (_sessionToken: string, callback: () => Promise<unknown>) => callback()),
}))

import { getOrgContext } from '@/lib/request-context'

describe('getOrgContext', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalRunnerKey = process.env.INTERNAL_RUNNER_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.INTERNAL_RUNNER_KEY
  })

  afterAll(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv })
    if (originalRunnerKey === undefined) {
      delete process.env.INTERNAL_RUNNER_KEY
    } else {
      Object.assign(process.env, { INTERNAL_RUNNER_KEY: originalRunnerKey })
    }
  })

  it('returns session-scoped organization for a valid session token', async () => {
    mockDb.userSession.findFirst.mockResolvedValueOnce({
      user: {
        id: 'user_1',
        organizationId: 'org_1',
      },
    })

    const request = new NextRequest('http://localhost/api/test', {
      headers: { 'x-session-token': 'token_1' },
    })

    await expect(getOrgContext(request)).resolves.toEqual({
      organizationId: 'org_1',
      userId: 'user_1',
    })
    expect(mockDb.userSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        token: hashSessionToken('token_1'),
        isActive: true,
        expiresAt: { gt: expect.any(Date) },
      }),
      select: expect.objectContaining({
        id: true,
        expiresAt: true,
        lastActiveAt: true,
        user: expect.any(Object),
      }),
    }))
  })

  it('rejects unauthenticated spoofed org and user headers', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-organization-id': 'org_spoofed',
        'x-user-id': 'user_spoofed',
        'x-user-email': 'spoofed@example.com',
      },
    })

    await expect(getOrgContext(request)).resolves.toBeNull()
  })

  it('allows x-organization-id override only for trusted internal runner requests', async () => {
    Object.assign(process.env, { INTERNAL_RUNNER_KEY: 'runner-secret' })
    mockDb.organization.findUnique.mockResolvedValueOnce({ id: 'org_internal' })

    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-internal-runner-key': 'runner-secret',
        'x-organization-id': 'org_internal',
      },
    })

    await expect(getOrgContext(request)).resolves.toEqual({
      organizationId: 'org_internal',
      userId: null,
    })
  })

  it('rejects x-organization-id override when internal key is invalid', async () => {
    Object.assign(process.env, { INTERNAL_RUNNER_KEY: 'runner-secret' })

    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-internal-runner-key': 'wrong-secret',
        'x-organization-id': 'org_internal',
      },
    })

    await expect(getOrgContext(request)).resolves.toBeNull()
    expect(mockDb.organization.findUnique).not.toHaveBeenCalled()
  })
})
