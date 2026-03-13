import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createCarrierSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(4000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const carriers = await db.carrier.findMany({
      where: { organizationId: context.organizationId },
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
    const limited = enforceRateLimit(request, { key: 'carriers-create', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parsed = await parseJsonBody(request, createCarrierSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
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
        organizationId: context.organizationId,
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
