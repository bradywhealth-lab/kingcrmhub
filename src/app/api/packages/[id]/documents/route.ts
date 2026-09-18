import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import {
  ObjectStorageNotConfiguredError,
  ObjectStorageUnavailableError,
  findMissingObjectStorageEnv,
  uploadToObjectStorage,
} from '@/lib/object-storage'
import { enforceRateLimit } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const STORAGE_UNAVAILABLE_MESSAGE =
  'Document storage is not configured. Document uploads are unavailable until an administrator configures storage.'
const STORAGE_BACKEND_FAILURE_MESSAGE =
  'Document storage is temporarily unavailable. Please try again later or contact support.'
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
    return withRequestOrgContext(request, async (context) => {
      const documents = await db.packageDocument.findMany({
        where: { packageId, organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ documents })
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

    // `return await` (not bare `return`) so a rejected handler promise is
    // caught by this try/catch instead of leaking to the framework as a
    // bare empty-body 500.
    return await withRequestOrgContext(request, async (context) => {
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

      const servicePackage = await db.servicePackage.findFirst({
        where: { id: packageId, organizationId: context.organizationId },
      })

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
        return NextResponse.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const { fileUrl, storagePath } = await uploadToObjectStorage({
        organizationId: context.organizationId,
        packageId,
        originalFileName: file.name,
        contentType: file.type || 'application/octet-stream',
        buffer,
      })

      const extractedText = await extractPackageText(file, buffer)
      const normalizedText = normalizeText(extractedText)

      const document = await db.packageDocument.create({
        data: {
          organizationId: context.organizationId,
          packageId,
          type,
          name: name.trim() || file.name,
          description: description.trim() || null,
          fileUrl,
          storagePath,
          fileType: file.type || null,
          fileSize: file.size || null,
          version: version.trim() || null,
          extractedText: normalizedText || null,
          indexedAt: normalizedText ? new Date() : null,
        },
      })

      let chunkCount = 0
      if (normalizedText) {
        const chunks = chunkText(normalizedText, CHUNK_SIZE, CHUNK_OVERLAP)
        chunkCount = chunks.length
        if (chunks.length > 0) {
          await db.packageDocumentChunk.createMany({
            data: chunks.map((content, index) => ({
              organizationId: context.organizationId,
              packageDocumentId: document.id,
              content,
              chunkIndex: index,
            })),
          })
        }
      }

      return NextResponse.json({
        document: {
          id: document.id,
          name: document.name,
          type: document.type,
          fileUrl: document.fileUrl,
          chunkCount,
        },
      })
    })
  } catch (error) {
    if (error instanceof ObjectStorageNotConfiguredError) {
      console.error('Package documents POST error:', error)
      return NextResponse.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
    if (error instanceof ObjectStorageUnavailableError) {
      // Storage backend rejected the operation (bucket missing, permission
      // denied, network). Upstream-dependency failure → 502 with a safe
      // message; the backend detail stays in server logs only (never echo
      // it to the client — it can leak infrastructure specifics).
      console.error('Package documents POST error:', error)
      return NextResponse.json({ error: STORAGE_BACKEND_FAILURE_MESSAGE }, { status: 502 })
    }
    console.error('Package documents POST error:', error)
    return NextResponse.json({ error: 'Failed to upload package document' }, { status: 500 })
  }
}

async function extractPackageText(file: File, buffer: Buffer): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop() || ''
  if (ext === 'pdf') {
    try {
      const pdfModule = await import('pdf-parse')
      const parser = new pdfModule.PDFParse({ data: buffer })
      const result = await parser.getText()
      await parser.destroy()
      return result.text || ''
    } catch {
      return ''
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
