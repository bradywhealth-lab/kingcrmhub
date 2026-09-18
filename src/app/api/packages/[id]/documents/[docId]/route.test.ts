import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  packageDocument: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

const mockDeleteFromObjectStorage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/object-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/object-storage')>()
  return {
    ...actual,
    deleteFromObjectStorage: mockDeleteFromObjectStorage,
  }
})

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

import { DELETE } from './route'
import { ObjectStorageNotConfiguredError } from '@/lib/object-storage'

const STORAGE_MESSAGE_FRAGMENT = 'Document storage is not configured'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/packages/[id]/documents/[docId] — storage unconfigured degradation', () => {
  it('returns 503 with a clear message when the storage layer throws ObjectStorageNotConfiguredError', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValueOnce({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      storagePath: 'packages/org_1/pkg_1/123-file.pdf',
    })
    mockDeleteFromObjectStorage.mockRejectedValueOnce(
      new ObjectStorageNotConfiguredError(['SUPABASE_URL']),
    )

    const response = await DELETE(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'pkg_1', docId: 'doc_1' }) },
    )

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain(STORAGE_MESSAGE_FRAGMENT)
    // Pin the cause: the 503 must come from the storage call, not a preflight
    // short-circuit — assert the delete was attempted with the doc's path.
    expect(mockDeleteFromObjectStorage).toHaveBeenCalledWith('packages/org_1/pkg_1/123-file.pdf')
    // The DB row must NOT be deleted when the storage cleanup could not run.
    expect(mockDb.packageDocument.delete).not.toHaveBeenCalled()
  })
})
