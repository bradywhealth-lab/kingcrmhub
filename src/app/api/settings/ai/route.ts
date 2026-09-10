import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { getDefaultModel } from '@/lib/ai-providers'

const AI_PROVIDERS = ['openrouter', 'groq', 'openai', 'anthropic'] as const
type AIProvider = (typeof AI_PROVIDERS)[number]

const aiSettingsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDERS).optional(),
  aiApiKey: z.string().max(500).optional(),
  aiModel: z.string().max(100).optional(),
})

function normalizeSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function maskKey(key: string | undefined | null): string | null {
  if (!key || typeof key !== 'string' || key.length < 8) return null
  return `${key.slice(0, 6)}${'•'.repeat(Math.min(key.length - 10, 30))}${key.slice(-4)}`
}

/**
 * Atlas Gate v1.4 — vendor-only labels for dropdown (no model names).
 * Model slugs are internal SDK params, imported from ai-providers.ts.
 */
const PROVIDER_LABELS: Record<AIProvider, string> = {
  openrouter: 'OpenRouter (Free)',
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/**
 * Atlas Gate v1.4 — customer-safe tier labels.
 * Vendor/model names are internal; customers see tier identity only.
 */
const TIER_LABELS = {
  standard: 'Standard — included',
  advanced: 'Advanced — bring your own key',
} as const

function getPlatformFallbacks() {
  return {
    openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    groq: Boolean(process.env.GROQ_API_KEY?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  }
}

function getProviderLabel(provider: AIProvider, hasKey: boolean) {
  if (provider === 'openrouter' || provider === 'groq') return TIER_LABELS.standard
  if (hasKey) return TIER_LABELS.advanced
  return TIER_LABELS.standard
}

// GET — return current AI settings (key masked)
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const org = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = normalizeSettings(org.settings)
      const provider = (AI_PROVIDERS.includes(settings.aiProvider as AIProvider)
        ? settings.aiProvider
        : 'groq') as AIProvider
      const hasKey = typeof settings.aiApiKey === 'string' && settings.aiApiKey.length > 0

      return NextResponse.json({
        provider,

        hasKey,
        maskedKey: hasKey ? maskKey(settings.aiApiKey as string) : null,
        providerLabel: getProviderLabel(provider, hasKey),
        platformFallbacks: getPlatformFallbacks(),
        availableProviders: AI_PROVIDERS.map((p) => ({
          id: p,
          label: PROVIDER_LABELS[p],

          requiresKey: !getPlatformFallbacks()[p],
        })),
      })
    })
  } catch (error) {
    console.error('AI settings GET error:', error)
    return NextResponse.json({ error: 'Failed to load AI settings' }, { status: 500 })
  }
}

// PATCH — update AI provider, model, and/or API key
export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-settings',
      limit: 20,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, aiSettingsSchema)
      if (!parsed.success) return parsed.response

      const org = await db.organization.findUnique({
        where: { id: context.organizationId },
        select: { settings: true },
      })
      if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

      const settings = normalizeSettings(org.settings)

      if (parsed.data.aiProvider !== undefined) {
        settings.aiProvider = parsed.data.aiProvider
        // Reset model to default when switching providers
        settings.aiModel = getDefaultModel(parsed.data.aiProvider)
      }
      if (parsed.data.aiModel !== undefined) {
        settings.aiModel = parsed.data.aiModel
      }
      if (parsed.data.aiApiKey !== undefined) {
        // Empty string = remove key
        settings.aiApiKey = parsed.data.aiApiKey || null
      }

      await db.organization.update({
        where: { id: context.organizationId },
        data: { settings: settings as Prisma.InputJsonValue },
      })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'update',
          entityType: 'organization',
          entityId: context.organizationId,
          actorId: context.userId,
          description: `Updated AI settings: provider=${settings.aiProvider || 'groq'}`,
          metadata: {
            aiProvider: String(settings.aiProvider || 'groq'),
            aiModel: String(settings.aiModel || ''),
            keyChanged: parsed.data.aiApiKey !== undefined,
          },
        },
      })

      const provider = (settings.aiProvider as AIProvider) || 'groq'
      const hasKey = typeof settings.aiApiKey === 'string' && settings.aiApiKey.length > 0

      return NextResponse.json({
        success: true,
        provider,

        hasKey,
        maskedKey: maskKey(settings.aiApiKey as string | null),
        providerLabel: getProviderLabel(provider, hasKey),
        platformFallbacks: getPlatformFallbacks(),
      })
    })
  } catch (error) {
    console.error('AI settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 })
  }
}
