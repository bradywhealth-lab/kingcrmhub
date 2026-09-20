import { NextRequest, NextResponse } from 'next/server'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { getOrgContext, withRequestOrgContext } from '@/lib/request-context'
import { enforceSameOrigin } from '@/lib/security'
import {
  deleteFromObjectStorage,
  findMissingObjectStorageEnv,
  uploadToObjectStorage,
} from '@/lib/object-storage'
import {
  STORAGE_UNCONFIGURED_MESSAGE,
  objectStorageErrorResponse,
} from '@/lib/object-storage-http'
import { serializePackageDocument } from '@/lib/package-documents'
import { enforceRateLimit } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

/**
 * Raised when a supported uploaded file parses as a failure rather than
 * empty text. The POST handler turns this into an explicit 422 and rolls
 * back the uploaded blob — a file stored but never indexed must not
 * report upload success (M159 fake-good).
 */
export class PdfExtractionError extends Error {
  constructor(cause: unknown) {
    super('Failed to extract text from the uploaded PDF')
    this.name = 'PdfExtractionError'
    if (cause instanceof Error) this.cause = cause
  }
}
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
])
const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: packageId } = await params
    // `return await` so a rejected handler promise reaches the catch below
    // instead of leaking as a bare empty-body 500 (pitfall 41).
    return await withRequestOrgContext(request, async (context) => {
      const documents = await db.packageDocument.findMany({
        where: { packageId, organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({
        documents: documents.map((document) =>
          serializePackageDocument(document),
        ),
      })
    })
  } catch (error) {
    console.error('Package documents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch package documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: packageId } = await params
    const limited = enforceRateLimit(request, { key: 'package-doc-upload', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    // This route deliberately does NOT wrap the whole handler in
    // withRequestOrgContext. That wrapper opens an interactive Prisma
    // transaction (withOrgRlsTransaction, 5000ms default timeout) and the
    // handler's storage upload + cold pdf-parse run INSIDE it — on a fresh
    // container the first upload exceeds 5000ms and the transaction expires
    // (t_771f12e9: "A query cannot be executed on an expired transaction").
    // Replicate the wrapper's CSRF + auth seams explicitly, keep short
    // org-scoped transactions around ONLY the DB reads/writes, and run the
    // slow network/CPU work outside any transaction.
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Every awaited DB call below runs inside one of the org-scoped
    // transactions; all work in between (validation, upload, extraction) is
    // transaction-free and may take as long as it needs.
    const orgId = context.organizationId

    // Malformed or non-multipart bodies make formData() throw. That is a
    // client error — map it to 400 here so the catch-all can't turn it
    // into a generic 500 (same class PR #180 closed for /api/upload;
    // regression t_2ef8e432: prod logged "Failed to parse body as
    // FormData." and clients saw 500 "Failed to upload package document").
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Request body must be multipart/form-data containing a "file" field' },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    const name = String(formData.get('name') || '')
    const type = String(formData.get('type') || 'other')
    const description = String(formData.get('description') || '')
    const version = String(formData.get('version') || '')

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'file must be between 1B and 10MB' }, { status: 400 })
    }

    const normalizedName = file.name.toLowerCase()
    const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.some((ext) => normalizedName.endsWith(ext))
    const hasAllowedMimeType = ALLOWED_UPLOAD_TYPES.has((file.type || '').toLowerCase())
    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed types: pdf, doc, docx, png, jpg' },
        { status: 400 }
      )
    }

    // Short transaction #1 (read-only): org-scoped existence check. Returns
    // as soon as it commits — the slow work below never holds it open.
    const servicePackage = await withOrgRlsTransaction(orgId, () =>
      db.servicePackage.findFirst({
        where: { id: packageId, organizationId: orgId },
      }),
    )

    if (!servicePackage) {
      return NextResponse.json({ error: 'Service package not found' }, { status: 404 })
    }

    // Graceful degradation: mirror the missing-AI-key 503 pattern — an
    // unconfigured storage backend is a service-availability problem, not
    // an unhandled server error.
    const missingStorageEnv = findMissingObjectStorageEnv()
    if (missingStorageEnv.length > 0) {
      console.error(
        'Package documents POST: object storage not configured, missing env vars:',
        missingStorageEnv.join(', ')
      )
      return NextResponse.json({ error: STORAGE_UNCONFIGURED_MESSAGE }, { status: 503 })
    }

    // Network upload — OUTSIDE any transaction (t_771f12e9).
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const { storagePath } = await uploadToObjectStorage({
      organizationId: orgId,
      packageId,
      originalFileName: file.name,
      contentType: file.type || 'application/octet-stream',
      buffer,
    })

    // Extraction (dynamic import + pdfjs worker spawn on first use — the
    // cold path that exceeded 5000ms after deploy) — OUTSIDE any
    // transaction.
    let extractedText: string
    try {
      extractedText = await extractPackageText(file, buffer)
    } catch (error) {
      if (error instanceof PdfExtractionError) {
        // Roll back the uploaded blob so a failing extraction never
        // leaves orphaned storage behind a fake-good response.
        try {
          await deleteFromObjectStorage(storagePath)
        } catch (rollbackError) {
          console.error(
            'Package documents POST: rollback of uploaded object failed:',
            rollbackError,
          )
        }
        return NextResponse.json(
          { error: 'Failed to extract text from the uploaded PDF. The document was not indexed.' },
          { status: 422 },
        )
      }
      throw error
    }
    const normalizedText = normalizeText(extractedText)

    // Precompute chunks BEFORE opening the write transaction: chunk-array
    // construction is CPU work proportional to text length, and the
    // interactive txn (5000ms default) must stay limited to the two DB
    // writes. A large text-bearing document can otherwise still expire the
    // write txn (cubic PR #198 R1, thread 3).
    const chunks = normalizedText
      ? chunkText(normalizedText, CHUNK_SIZE, CHUNK_OVERLAP)
      : []
    const chunkCount = chunks.length
    // Chunk payloads are also prepared outside the txn: only the document
    // id (known after create resolves) is attached inside, so the write
    // txn itself is limited to the two DB calls.
    const chunkPayloads = chunks.map((content, index) => ({ content, chunkIndex: index }))

    // Short transaction #2 (write): document row + chunks commit
    // atomically — a createMany rejection rolls back the create (no
    // orphan row). Same statuses and payloads as the pre-hoist route.
    return await withOrgRlsTransaction(orgId, async () => {
      const document = await db.packageDocument.create({
        data: {
          organizationId: orgId,
          packageId,
          type,
          name: name.trim() || file.name,
          description: description.trim() || null,
          // M173: never persist a public bucket URL. The gated download URL
          // is derived by the serializers; storagePath stays server-side for
          // delete/download. `fileUrl` is persisted only because the schema
          // requires a String — it is never read (legacy rows keep their old
          // value and are still served through the gated path).
          fileUrl: '',
          storagePath,
          fileType: file.type || null,
          fileSize: file.size || null,
          version: version.trim() || null,
          extractedText: normalizedText || null,
          indexedAt: normalizedText ? new Date() : null,
        },
      })

      if (chunkPayloads.length > 0) {
        await db.packageDocumentChunk.createMany({
          data: chunkPayloads.map(({ content, chunkIndex }) => ({
            organizationId: orgId,
            packageDocumentId: document.id,
            content,
            chunkIndex,
          })),
        })
      }

      return NextResponse.json({
        document: {
          ...serializePackageDocument(document),
          chunkCount,
        },
      })
    })
  } catch (error) {
    // Typed storage errors map to 503 (unconfigured) / 502 (backend
    // failure) via the shared helper — backend detail stays server-side.
    const storageResponse = objectStorageErrorResponse(error)
    console.error('Package documents POST error:', error)
    if (storageResponse) return storageResponse
    return NextResponse.json({ error: 'Failed to upload package document' }, { status: 500 })
  }
}

async function extractPackageText(file: File, buffer: Buffer): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop() || ''
  if (ext === 'pdf') {
    try {
      const pdfModule = await import('pdf-parse')
      const parser = new pdfModule.PDFParse({ data: buffer }) as {
        getText(): Promise<{ text: string }>
        destroy(): Promise<void>
      }
      try {
        const result = await parser.getText()
        const text = result.text || ''
        if (!text) {
          // Success-but-empty is still invisible behind a 200 fake-good
          // status — log it explicitly. Image-only/scanned PDFs legitimately
          // yield ''; a text-bearing PDF yielding '' is a defect.
          console.error(
            'Package documents POST: PDF text extraction produced empty text for',
            file.name,
          )
        }
        return text
      } finally {
        // Destroy on every path, including getText() throwing — otherwise
        // repeated failed uploads accumulate pdfjs workers in a
        // long-running server process.
        await parser.destroy().catch(() => {})
      }
    } catch (error) {
      // M159: never swallow extraction failures silently. The caller maps
      // this to an explicit non-2xx so upload is not fake-good 200.
      console.error('Package documents POST: PDF text extraction failed:', error)
      throw new PdfExtractionError(error)
    }
  }
  if (ext === 'docx') {
    try {
      // Optional runtime dependency: keep dynamic to avoid bundler hard-fail
      // when mammoth is intentionally absent in lean deploy targets.
      const dynamicImport = new Function(
        'm',
        'return import(m)'
      ) as (moduleName: string) => Promise<{
        extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }>
      }>
      const mammoth = await dynamicImport('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    } catch {
      return ''
    }
  }
  if (ext === 'doc') {
    return buffer.toString('utf-8')
  }
  if (['txt', 'md', 'csv'].includes(ext)) {
    return buffer.toString('utf-8')
  }
  return ''
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.min(overlap, words.length))
      currentChunk = overlapWords.join(' ') + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
