import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { z } from 'zod'

const socialAccountSchema = z.object({
  platform: z.string().min(1).max(40),
  accountId: z.string().min(1).max(120),
  accountName: z.string().max(120).optional(),
  accessToken: z.string().min(1).max(500),
  refreshToken: z.string().max(500).optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  profileData: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

const socialAccountPatchSchema = socialAccountSchema.partial()

function redactAccount(account: {
  id: string
  platform: string
  accountId: string
  accountName: string | null
  tokenExpiresAt: Date | null
  profileData: Prisma.JsonValue | null
  isActive: boolean
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...account,
    accessTokenConfigured: true,
    profileData:
      account.profileData && typeof account.profileData === 'object' && !Array.isArray(account.profileData)
        ? account.profileData
        : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const accounts = await db.socialAccount.findMany({
        where: { organizationId: context.organizationId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          platform: true,
          accountId: true,
          accountName: true,
          tokenExpiresAt: true,
          profileData: true,
          isActive: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ accounts: accounts.map(redactAccount) })
    })
  } catch (error) {
    console.error('Social accounts GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch social accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'social-accounts-create', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, socialAccountSchema)
      if (!parsed.success) return parsed.response

      const account = await db.socialAccount.upsert({
        where: {
          organizationId_platform_accountId: {
            organizationId: context.organizationId,
            platform: parsed.data.platform.trim(),
            accountId: parsed.data.accountId.trim(),
          },
        },
        update: {
          accountName: parsed.data.accountName?.trim() || null,
          accessToken: parsed.data.accessToken.trim(),
          refreshToken: parsed.data.refreshToken?.trim() || null,
          tokenExpiresAt: parsed.data.tokenExpiresAt ? new Date(parsed.data.tokenExpiresAt) : null,
          profileData: parsed.data.profileData as Prisma.InputJsonValue | undefined,
          isActive: parsed.data.isActive ?? true,
          lastSyncedAt: new Date(),
        },
        create: {
          organizationId: context.organizationId,
          platform: parsed.data.platform.trim(),
          accountId: parsed.data.accountId.trim(),
          accountName: parsed.data.accountName?.trim() || null,
          accessToken: parsed.data.accessToken.trim(),
          refreshToken: parsed.data.refreshToken?.trim() || null,
          tokenExpiresAt: parsed.data.tokenExpiresAt ? new Date(parsed.data.tokenExpiresAt) : null,
          profileData: parsed.data.profileData as Prisma.InputJsonValue | undefined,
          isActive: parsed.data.isActive ?? true,
          lastSyncedAt: new Date(),
        },
        select: {
          id: true,
          platform: true,
          accountId: true,
          accountName: true,
          tokenExpiresAt: true,
          profileData: true,
          isActive: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ account: redactAccount(account) })
    })
  } catch (error) {
    console.error('Social accounts POST error:', error)
    return NextResponse.json({ error: 'Failed to save social account' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'social-accounts-update', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return await withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const parsed = await parseJsonBody(request, socialAccountPatchSchema)
      if (!parsed.success) return parsed.response

      const data: Prisma.SocialAccountUpdateManyMutationInput = {}
      if (parsed.data.platform !== undefined) data.platform = parsed.data.platform.trim()
      if (parsed.data.accountId !== undefined) data.accountId = parsed.data.accountId.trim()
      if (parsed.data.accountName !== undefined) data.accountName = parsed.data.accountName?.trim() || null
      if (parsed.data.accessToken !== undefined) data.accessToken = parsed.data.accessToken.trim()
      if (parsed.data.refreshToken !== undefined) data.refreshToken = parsed.data.refreshToken?.trim() || null
      if (parsed.data.tokenExpiresAt !== undefined) data.tokenExpiresAt = parsed.data.tokenExpiresAt ? new Date(parsed.data.tokenExpiresAt) : null
      if (parsed.data.profileData !== undefined) data.profileData = parsed.data.profileData as Prisma.InputJsonValue
      if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive
      data.lastSyncedAt = new Date()

      const updated = await db.socialAccount.updateMany({
        where: { id, organizationId: context.organizationId },
        data,
      })

      if (updated.count === 0) {
        return NextResponse.json({ error: 'Social account not found' }, { status: 404 })
      }

      const account = await db.socialAccount.findUnique({
        where: { id },
        select: {
          id: true,
          platform: true,
          accountId: true,
          accountName: true,
          tokenExpiresAt: true,
          profileData: true,
          isActive: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ account: account ? redactAccount(account) : null })
    })
  } catch (error) {
    console.error('Social accounts PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update social account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'social-accounts-delete', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return await withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const deleted = await db.socialAccount.deleteMany({
        where: { id, organizationId: context.organizationId },
      })

      if (deleted.count === 0) {
        return NextResponse.json({ error: 'Social account not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Social accounts DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete social account' }, { status: 500 })
  }
}
