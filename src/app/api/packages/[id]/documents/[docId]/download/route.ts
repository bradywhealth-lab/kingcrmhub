import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import {
  downloadFromObjectStorage,
  isInlineStoragePath,
  parseDataUrl,
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
      let contentType = validMediaType(document.fileType) || 'application/octet-stream'

      if (document.storagePath) {
        const inline = parseInlineStoragePath(document.storagePath)
        if (inline) {
          // Dev fallback storage: object storage was unavailable at upload
          // time and the file lives inline in the storage path. Decode and
          // stream it through the same auth-gated endpoint so the client
          // surface stays uniform.
          buffer = inline.buffer
          contentType = validMediaType(inline.contentType) || contentType
        } else if (isInlineStoragePath(document.storagePath)) {
          // Legacy dev-fallback marker (`inline:<object-path>`): the bytes
          // were stored in the row's fileUrl as a data URL.
          const legacy = parseDataUrl(document.fileUrl || '')
          if (!legacy) {
            return NextResponse.json(
              { error: 'Document bytes are unavailable' },
              { status: 404 },
            )
          }
          buffer = legacy.buffer
          contentType = validMediaType(legacy.contentType) || contentType
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
 * The `filename*` value percent-encodes every reserved character (`'`, `(`,
 * `)`, `*` included) that RFC 5987 forbids unencoded.
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii || 'document'}"; filename*=UTF-8''${encodeRFC5987(fileName)}`
}

/** Percent-encodes everything outside RFC 5987's attr-char set. */
function encodeRFC5987(value: string): string {
  // Array.from iterates code points, not UTF-16 units: an emoji surrogate
  // pair stays one character, so encodeURIComponent never sees a lone
  // surrogate (which would throw URIError and 500 the download).
  return Array.from(value)
    .map((char) =>
      /^[!#$&+.^_`|A-Za-z0-9-]$/.test(char) ? char : encodeURIComponent(char),
    )
    .join('')
}

/** True for a well-formed media type; invalid legacy values fall back. */
function validMediaType(value?: string | null): string {
  const trimmed = value?.trim() || ''
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(trimmed)
    ? trimmed
    : ''
}
