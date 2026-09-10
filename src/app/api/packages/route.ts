import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createPackageSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(4000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const servicePackages = await db.servicePackage.findMany({
      where: { organizationId: context.organizationId },
      include: {
        _count: { select: { packageDocuments: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ servicePackages })
    })
  } catch (error) {
    console.error('ServicePackages GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch service packages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'packages-create', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, createPackageSchema)
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

    const servicePackage = await db.servicePackage.create({
      data: {
        organizationId: context.organizationId,
        name: name.trim(),
        slug: normalizedSlug,
        logoUrl: logoUrl?.trim() || null,
        website: website?.trim() || null,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ servicePackage })
    })
  } catch (error) {
    console.error('ServicePackages POST error:', error)
    return NextResponse.json({ error: 'Failed to create service package' }, { status: 500 })
  }
}
