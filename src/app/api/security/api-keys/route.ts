import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { hashSessionToken } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(120),
})

function readSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

type StoredApiKey = {
  id: string
  name: string
  keyHash: string
  preview: string
  createdAt: string
  revokedAt?: string | null
}

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const organization = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      const settings = readSettings(organization?.settings ?? null)
      const apiKeys = Array.isArray(settings.apiKeys) ? settings.apiKeys as StoredApiKey[] : []
      return NextResponse.json({
        apiKeys: apiKeys.sort((a, b) => {
          if (!!a.revokedAt !== !!b.revokedAt) return a.revokedAt ? 1 : -1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }),
      })
    })
  } catch (error) {
    console.error('API keys GET error:', error)
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'security-api-keys', limit: 20, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, createSchema)
      if (!parsed.success) return parsed.response

      const organization = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = readSettings(organization.settings)
      const apiKeys = Array.isArray(settings.apiKeys) ? settings.apiKeys as StoredApiKey[] : []
      const rawKey = `ifz_${randomBytes(18).toString('hex')}`
      const record: StoredApiKey = {
        id: randomBytes(10).toString('hex'),
        name: parsed.data.name.trim(),
        keyHash: hashSessionToken(rawKey),
        preview: `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`,
        createdAt: new Date().toISOString(),
      }

      settings.apiKeys = [record, ...apiKeys]

      await db.organization.update({
        where: { id: context.organizationId },
        data: { settings: settings as Prisma.InputJsonValue },
      })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'create',
          entityType: 'api_key',
          entityId: record.id,
          actorId: context.userId,
          description: `Created API key ${record.name}`,
          metadata: { preview: record.preview },
        },
      })

      return NextResponse.json({ apiKey: record, rawKey })
    })
  } catch (error) {
    console.error('API keys POST error:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'security-api-keys-delete', limit: 40, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const organization = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = readSettings(organization.settings)
      const apiKeys = Array.isArray(settings.apiKeys) ? settings.apiKeys as StoredApiKey[] : []
      const target = apiKeys.find((key) => key.id === id)
      if (!target) return NextResponse.json({ error: 'API key not found' }, { status: 404 })

      settings.apiKeys = apiKeys.map((key) =>
        key.id === id
          ? {
              ...key,
              revokedAt: key.revokedAt || new Date().toISOString(),
            }
          : key,
      )

      await db.organization.update({
        where: { id: context.organizationId },
        data: { settings: settings as Prisma.InputJsonValue },
      })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'revoke',
          entityType: 'api_key',
          entityId: id,
          actorId: context.userId,
          description: `Revoked API key ${target.name}`,
          metadata: { preview: target.preview },
        },
      })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('API keys DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
  }
}
