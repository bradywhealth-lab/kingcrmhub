import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import {
  downloadFromObjectStorage,
  parseInlineStoragePath,
} from '@/lib/object-storage'
import { objectStorageErrorResponse } from '@/lib/object-storage-http'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * Auth-gated package-document download (M173).
 *
 * Raw public bucket URLs are gone: this route is the ONLY way clients fetch
 * document bytes. It resolves the document under the caller's tenant scope
 * (same withRequestOrgContext / organizationId RLS check as every other
 * document route), then streams the bytes. Cross-tenant and missing rows
 * 404 exactly like the detail route — tenant isolation is enforced by the
 * same scoped query, never by URL secrecy.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id: packageId, docId } = await params
    const limited = enforceRateLimit(request, { key: 'package-doc-download', limit: 120, windowMs: 60_000 })
    if (limited) return limited

    // `return await` so a rejected handler promise (e.g. storage errors)
    // reaches the catch below instead of leaking as a bare empty-body 500.
    return await withRequestOrgContext(request, async (context) => {
      const document = await db.packageDocument.findFirst({
        where: {
          id: docId,
          packageId,
          organizationId: context.organizationId,
        },
      })

      if (!document) {
        // Cross-tenant and unknown docs are indistinguishable: 404.
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      let buffer: Buffer
      let contentType = document.fileType?.trim() || 'application/octet-stream'

      if (document.storagePath) {
        const inline = parseInlineStoragePath(document.storagePath)
        if (inline) {
          // Dev fallback storage: object storage was unavailable at upload
          // time and the file lives inline in the storage path. Decode and
          // stream it through the same auth-gated endpoint so the client
          // surface stays uniform.
          buffer = inline.buffer
          contentType = inline.contentType || contentType
        } else {
          buffer = await downloadFromObjectStorage(document.storagePath)
        }
      } else {
        // Storage-unavailable degradation (pre-M173 rows can lack a path):
        // no server-side bytes exist to stream.
        return NextResponse.json(
          { error: 'Document bytes are unavailable' },
          { status: 404 },
        )
      }

      const disposition = contentDisposition(document.name || 'document')
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buffer.length),
          'Content-Disposition': disposition,
          'Cache-Control': 'private, no-store',
        },
      })
    })
  } catch (error) {
    // Shared mapping with upload/delete: 503 unconfigured / 502 backend.
    const storageResponse = objectStorageErrorResponse(error)
    if (storageResponse) return storageResponse
    console.error('PackageDocument download error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}

/**
 * RFC 5987 UTF-8 header-safe filename: ASCII fallback plus standard encoding
 * for anything else, so unicode names download correctly on every client.
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii || 'document'}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}
