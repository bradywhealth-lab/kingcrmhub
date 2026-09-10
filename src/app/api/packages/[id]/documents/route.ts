import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { uploadToObjectStorage } from '@/lib/object-storage'
import { enforceRateLimit } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }
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

    return withRequestOrgContext(request, async (context) => {
      const formData = await request.formData()

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
    console.error('Package documents POST error:', error)
    return NextResponse.json({ error: 'Failed to upload package document' }, { status: 500 })
  }
}

async function extractPackageText(file: File, buffer: Buffer): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop() || ''
  if (ext === 'pdf') {
    try {
      const pdfModule: any = await import('pdf-parse')
      const pdfParse = (pdfModule.default || pdfModule) as (buf: Buffer) => Promise<{ text: string }>
      const result = await pdfParse(buffer)
      return result.text || ''
    } catch {
      return ''
    }
  }
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
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
