import { describe, it, expect, vi } from 'vitest'
import { requireAdminRole } from './admin-auth'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

import { db } from '@/lib/db'

describe('admin-auth middleware', () => {
  it('should allow access to admin users', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'admin',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toHaveProperty('userId', 'user-1')
  })

  it('should allow access to owner users', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'owner',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toHaveProperty('userId', 'user-1')
  })

  it('should deny access to regular members', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'member',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toBeInstanceOf(Response)
    expect(await (result as Response).text()).toContain('Forbidden')
  })
})
