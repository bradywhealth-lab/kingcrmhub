import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const AI_PROVIDERS = ['groq', 'openai', 'anthropic'] as const
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

const PROVIDER_DEFAULTS: Record<AIProvider, { model: string; label: string }> = {
  groq: { model: 'llama-3.3-70b-versatile', label: 'Groq (Llama 3.3 70B) — Free' },
  openai: { model: 'gpt-4o', label: 'OpenAI (GPT-4o)' },
  anthropic: { model: 'claude-sonnet-4-20250514', label: 'Anthropic (Claude Sonnet)' },
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
      const model =
        typeof settings.aiModel === 'string' && settings.aiModel
          ? settings.aiModel
          : PROVIDER_DEFAULTS[provider].model
      const hasKey = typeof settings.aiApiKey === 'string' && settings.aiApiKey.length > 0

      return NextResponse.json({
        provider,
        model,
        hasKey,
        maskedKey: hasKey ? maskKey(settings.aiApiKey as string) : null,
        providerLabel: PROVIDER_DEFAULTS[provider].label,
        availableProviders: AI_PROVIDERS.map((p) => ({
          id: p,
          label: PROVIDER_DEFAULTS[p].label,
          defaultModel: PROVIDER_DEFAULTS[p].model,
          requiresKey: p !== 'groq', // groq uses platform key as fallback
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
        settings.aiModel = PROVIDER_DEFAULTS[parsed.data.aiProvider].model
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

      return NextResponse.json({
        success: true,
        provider,
        model: settings.aiModel || PROVIDER_DEFAULTS[provider].model,
        hasKey:
          typeof settings.aiApiKey === 'string' && settings.aiApiKey.length > 0,
        maskedKey: maskKey(settings.aiApiKey as string | null),
        providerLabel: PROVIDER_DEFAULTS[provider].label,
      })
    })
  } catch (error) {
    console.error('AI settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 })
  }
}
