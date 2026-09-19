import { describe, expect, it } from 'vitest'
import {
  packageDocumentDownloadPath,
  serializePackageDocument,
  serializePackageDocumentDetail,
  serializePackageDocumentRow,
  type PackageDocumentDetail,
  type PackageDocumentListItem,
} from './package-documents'

const LEGACY_PUBLIC_FILE_URL =
  'https://example.supabase.co/storage/v1/object/public/carrier-documents/old.png'

function legacyListItem(): PackageDocumentListItem {
  // A real legacy row carries a public bucket URL and storage internals.
  const row = {
    id: 'doc_1',
    packageId: 'pkg_1',
    type: 'brochure',
    name: 'plan.pdf',
    description: 'desc',
    fileType: 'application/pdf',
    fileSize: 1024,
    version: 'v1',
    createdAt: new Date('2026-09-19T00:00:00Z'),
    fileUrl: LEGACY_PUBLIC_FILE_URL,
    storagePath: 'packages/org_1/pkg_1/1-plan.pdf',
    extractedText: 'top secret extracted text',
  } as PackageDocumentListItem
  return row
}

function legacyDetail(): PackageDocumentDetail {
  const row = {
    id: 'doc_1',
    packageId: 'pkg_1',
    type: 'other',
    name: 'notes.txt',
    description: null,
    fileType: 'text/plain',
    fileSize: 42,
    version: null,
    createdAt: new Date('2026-09-19T00:00:00Z'),
    updatedAt: new Date('2026-09-19T00:00:00Z'),
    fileUrl: LEGACY_PUBLIC_FILE_URL,
    storagePath: 'packages/org_1/pkg_1/1-notes.txt',
    extractedText: 'secret',
    chunks: [{ id: 'chunk_1', chunkIndex: 0 }],
  } as unknown as PackageDocumentDetail
  return row
}

describe('package-document serializers — no public URL leakage (M173)', () => {
  it('derives the auth-gated relative download path for a package document', () => {
    expect(packageDocumentDownloadPath('pkg_1', 'doc_1')).toBe(
      '/api/packages/pkg_1/documents/doc_1/download',
    )
  })

  it('serializes a list row with a gated URL, never storage internals', () => {
    const out = serializePackageDocument(legacyListItem())

    expect(out.fileUrl).toBe('/api/packages/pkg_1/documents/doc_1/download')
    expect(out.fileUrl.startsWith('http')).toBe(false)
    expect(Object.hasOwn(out, 'storagePath')).toBe(false)
    expect(Object.hasOwn(out, 'extractedText')).toBe(false)
    expect(JSON.stringify(out)).not.toContain('supabase.co')
  })

  it('serializes a detail row with chunks and a gated URL', () => {
    const out = serializePackageDocumentDetail(legacyDetail())

    expect(out.fileUrl).toBe('/api/packages/pkg_1/documents/doc_1/download')
    expect(out.chunks).toHaveLength(1)
    expect(Object.hasOwn(out, 'storagePath')).toBe(false)
    expect(Object.hasOwn(out, 'fileUrl')).toBe(true)
    expect(JSON.stringify(out)).not.toContain('supabase.co')
    expect(JSON.stringify(out)).not.toContain('secret')
  })

  it('serializes a full Prisma row, replacing only the leaked fileUrl (M173)', () => {
    const row = {
      id: 'doc_2',
      packageId: 'pkg_2',
      organizationId: 'org_1',
      type: 'brochure',
      name: 'scope.pdf',
      description: 'desc',
      fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/old2.png',
      storagePath: 'packages/org_1/pkg_2/2-scope.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      version: null,
      extractedText: 'sensitive extracted text',
      createdAt: new Date('2026-09-19T00:00:00Z'),
      updatedAt: new Date('2026-09-19T00:00:00Z'),
    }

    const out = serializePackageDocumentRow(row)

    expect(out.fileUrl).toBe('/api/packages/pkg_2/documents/doc_2/download')
    expect(out.storagePath).toBe('packages/org_1/pkg_2/2-scope.pdf')
    expect(out.extractedText).toBe('sensitive extracted text')
    expect(out.organizationId).toBe('org_1')
    expect(out.fileSize).toBe(2048)
    expect(JSON.stringify(out)).not.toContain('supabase.co')
    expect(JSON.stringify(out)).not.toContain('/storage/v1/object/public')
  })
})
