import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { redactTwilioConfig } from '@/lib/twilio'
import { z } from 'zod'

const integrationSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1).max(120),
  isActive: z.boolean().optional(),
  config: z.object({
    accountSid: z.string().min(1).optional(),
    authToken: z.string().min(1).optional(),
    fromPhone: z.string().min(1).optional(),
  }).passthrough(),
})

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const type = request.nextUrl.searchParams.get('type')

      if (type) {
        const integration = await db.integration.findUnique({
          where: {
            organizationId_type: {
              organizationId: context.organizationId,
              type,
            },
          },
        })

        return NextResponse.json({
          integration: integration
            ? {
                id: integration.id,
                type: integration.type,
                name: integration.name,
                isActive: integration.isActive,
                syncStatus: integration.syncStatus,
                syncError: integration.syncError,
                config:
                  type === 'twilio'
                    ? redactTwilioConfig(integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
                        ? integration.config as Record<string, unknown>
                        : null)
                    : integration.config,
              }
            : null,
        })
      }

      const integrations = await db.integration.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'asc' },
      })

      return NextResponse.json({
        integrations: integrations.map((integration) => ({
          id: integration.id,
          type: integration.type,
          name: integration.name,
          isActive: integration.isActive,
          syncStatus: integration.syncStatus,
          syncError: integration.syncError,
          config:
            integration.type === 'twilio'
              ? redactTwilioConfig(integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
                  ? integration.config as Record<string, unknown>
                  : null)
              : integration.config,
        })),
      })
    })
  } catch (error) {
    console.error('Integrations GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'integrations-upsert', limit: 40, windowMs: 60_000 })
    if (limited) return limited

    return await withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, integrationSchema)
      if (!parsed.success) return parsed.response

      const existing = await db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: context.organizationId,
            type: parsed.data.type,
          },
        },
      })

      const existingConfig =
        existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config)
          ? existing.config as Record<string, unknown>
          : {}

      const mergedConfig = {
        ...existingConfig,
        ...parsed.data.config,
      }

      if (parsed.data.type === 'twilio' && typeof parsed.data.config.authToken !== 'string' && typeof existingConfig.authToken === 'string') {
        mergedConfig.authToken = existingConfig.authToken
      }

      const integration = await db.integration.upsert({
        where: {
          organizationId_type: {
            organizationId: context.organizationId,
            type: parsed.data.type,
          },
        },
        update: {
          name: parsed.data.name,
          isActive: parsed.data.isActive ?? true,
          config: mergedConfig as Prisma.InputJsonValue,
          syncStatus: 'configured',
          syncError: null,
        },
        create: {
          organizationId: context.organizationId,
          type: parsed.data.type,
          name: parsed.data.name,
          isActive: parsed.data.isActive ?? true,
          config: mergedConfig as Prisma.InputJsonValue,
          syncStatus: 'configured',
        },
      })

      return NextResponse.json({
        integration: {
          id: integration.id,
          type: integration.type,
          name: integration.name,
          isActive: integration.isActive,
          syncStatus: integration.syncStatus,
          syncError: integration.syncError,
          config:
            integration.type === 'twilio'
              ? redactTwilioConfig(mergedConfig)
              : integration.config,
        },
      })
    })
  } catch (error) {
    console.error('Integrations PUT error:', error)
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 })
  }
}
