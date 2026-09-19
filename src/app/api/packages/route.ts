import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isUniqueConstraintViolation } from '@/lib/prisma-errors'

const createPackageSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(4000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    // `await` keeps rejections inside the try/catch (opaque-500 bug class).
    return await withRequestOrgContext(request, async (context) => {
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
    // `await` is required: without it a rejection inside the handler (e.g.
    // Prisma P2002) escapes this try/catch and Next.js returns an opaque
    // empty-body 500 instead of the discriminated 409 below.
    return await withRequestOrgContext(request, async (context) => {
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
    // Unique index is [organizationId, slug] and slug is derived from name, so
    // a duplicate name inside the same org raises P2002. Return a clear 409
    // (matching the duplicate-lead pattern); genuine failures stay 500.
    if (isUniqueConstraintViolation(error)) {
      console.warn('ServicePackages POST conflict (P2002):', error)
      return NextResponse.json(
        { error: 'A service package with that name or slug already exists.' },
        { status: 409 },
      )
    }
    console.error('ServicePackages POST error:', error)
    return NextResponse.json({ error: 'Failed to create service package' }, { status: 500 })
  }
}
