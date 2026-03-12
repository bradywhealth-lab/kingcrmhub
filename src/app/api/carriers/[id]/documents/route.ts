import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const ORGANIZATION_ID = 'demo-org-1'
type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const documents = await db.carrierDocument.findMany({
      where: { carrierId: id, organizationId: ORGANIZATION_ID },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Carrier documents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch carrier documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const name = String(formData.get('name') || '')
    const type = String(formData.get('type') || 'other')
    const description = String(formData.get('description') || '')
    const version = String(formData.get('version') || '')

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const now = Date.now()
    const relativeDir = path.join('uploads', 'carriers', id)
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir)
    await mkdir(absoluteDir, { recursive: true })

    const savedFileName = `${now}-${safeName}`
    const absolutePath = path.join(absoluteDir, savedFileName)
    await writeFile(absolutePath, buffer)

    const fileUrl = `/${relativeDir}/${savedFileName}`
    const document = await db.carrierDocument.create({
      data: {
        organizationId: ORGANIZATION_ID,
        carrierId: id,
        type,
        name: name.trim() || file.name,
        description: description.trim() || null,
        fileUrl,
        fileType: file.type || null,
        fileSize: file.size || null,
        version: version.trim() || null,
      },
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Carrier documents POST error:', error)
    return NextResponse.json({ error: 'Failed to upload carrier document' }, { status: 500 })
  }
}
