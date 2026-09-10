import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createDocumentSchema = z.object({
  type: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  fileUrl: z.string().url(),
  storagePath: z.string().max(1000).optional(),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().positive().optional(),
  version: z.string().max(100).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    console.error('PackageDocuments GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch package documents' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: packageId } = await params
    const limited = enforceRateLimit(request, { key: 'package-documents-create', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createDocumentSchema)
      if (!parsed.success) return parsed.response
      const body = parsed.data

      const servicePackage = await db.servicePackage.findFirst({
        where: { id: packageId, organizationId: context.organizationId },
      })

      if (!servicePackage) {
        return NextResponse.json({ error: 'Service package not found' }, { status: 404 })
      }

      const document = await db.packageDocument.create({
        data: {
          organizationId: context.organizationId,
          packageId,
          type: body.type,
          name: body.name,
          description: body.description?.trim() || null,
          fileUrl: body.fileUrl,
          storagePath: body.storagePath?.trim() || null,
          fileType: body.fileType?.trim() || null,
          fileSize: body.fileSize || null,
          version: body.version?.trim() || null,
        },
      })

      return NextResponse.json({ document })
    })
  } catch (error) {
    console.error('PackageDocuments POST error:', error)
    return NextResponse.json({ error: 'Failed to create package document' }, { status: 500 })
  }
}
