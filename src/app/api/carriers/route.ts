import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ORGANIZATION_ID = 'demo-org-1'

export async function GET() {
  try {
    const carriers = await db.carrier.findMany({
      where: { organizationId: ORGANIZATION_ID },
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ carriers })
  } catch (error) {
    console.error('Carriers GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch carriers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, logoUrl, website, notes } = body as {
      name: string
      slug?: string
      logoUrl?: string
      website?: string
      notes?: string
    }

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const normalizedSlug =
      slug?.trim().toLowerCase() ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

    const carrier = await db.carrier.create({
      data: {
        organizationId: ORGANIZATION_ID,
        name: name.trim(),
        slug: normalizedSlug,
        logoUrl: logoUrl?.trim() || null,
        website: website?.trim() || null,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ carrier })
  } catch (error) {
    console.error('Carriers POST error:', error)
    return NextResponse.json({ error: 'Failed to create carrier' }, { status: 500 })
  }
}
