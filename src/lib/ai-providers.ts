import type { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'

export type AIProvider = 'groq' | 'openai' | 'anthropic' | 'openrouter'

type AIConfig = {
  provider: AIProvider
  model: string
  apiKey: string
  label: string
  /** Set when the org's saved BYOK key was rejected/skipped and we fell back to the platform free tier. */
  byokFailure?: string
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Placeholder/junk keys that can be saved through the Settings UI but will
 * never authenticate. Treating these as "no key" lets the platform free tier
 * resolve instead of letting a bogus BYOK key shadow it (production 2026-09-19:
 * every chat 401'd with "Missing Authentication header" because a placeholder
 * BYOK key existed and the free fallback was skipped).
 */
const BYOK_INVALID_PATTERNS: RegExp[] = [
  /^sk-placeholder$/i,
  /^placeholder$/i,
  /^your[_-]?key$/i,
  /^xxx+$/i,
  /^test(ing)?$/i,
  /^api[_-]?key$/i,
  /^(sk|key)-?$/i,
  /^null$/i,
  /^undefined$/i,
]

function isInvalidByokKey(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return true
  if (trimmed.length < 8) return true
  if (BYOK_INVALID_PATTERNS.some((p) => p.test(trimmed.replace(/\s+/g, '')))) return true
  return false
}

function normalizeSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isAuthClassError(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined
  if (typeof status === 'number' && (status === 401 || status === 403)) return true
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return /401|403|invalid api|api key|auth|permission|missing .*header|denied|forbidden|unauthorized/i.test(msg)
}

function isOutageClassError(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined
  if (typeof status === 'number' && status >= 500) return true
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return /5\d\d|overloaded|unavailable|timeout|temporarily/i.test(msg)
}

/**
 * Client-safe error messages. Raw SDK text (e.g. "401 Missing Authentication
 * header") must NEVER reach the user — it is confusing and exposes provider
 * internals with no actionable info.
 */
export function friendlyProviderError(provider: AIProvider, err: unknown, byokFailure?: string): string {
  if (isAuthClassError(err)) {
    return byokFailure && byokFailure.length > 0
      ? byokFailure
      : 'Your AI provider key is invalid or expired — open Settings → AI to fix it.'
  }
  if (isOutageClassError(err)) {
    return 'AI provider temporarily unavailable. Please try again in a moment.'
  }
  return 'AI provider error. Please try again. If it persists, check your provider settings in Settings → AI.'
}

/**
 * Resolve the AI config for an organization.
 * Priority:
 * 1. Org-level BYOK key + chosen provider (ONLY when the key is plausibly real —
 *    placeholder/empty/junk keys do not shadow the free tier)
 * 2. Platform env key for the org's chosen provider
 * 3. OpenRouter free tier (auto-routing)
 * 4. Groq free tier
 * 5. Last-resort platform keys
 * 6. No provider
 */
export async function resolveAIConfig(organizationId: string): Promise<AIConfig> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const settings = normalizeSettings(org?.settings ?? null)
  const provider = (['groq', 'openai', 'anthropic', 'openrouter'].includes(settings.aiProvider as string)
    ? settings.aiProvider
    : null) as AIProvider | null
  const storedKey = typeof settings.aiApiKey === 'string' ? settings.aiApiKey : null
  const orgKey = storedKey && !isInvalidByokKey(storedKey) ? storedKey : null
  const model = typeof settings.aiModel === 'string' && settings.aiModel
    ? settings.aiModel
    : null

  const byokFailure = storedKey && !orgKey
    ? 'Your saved AI provider key is invalid or missing — using the platform free tier. Open Settings → AI to fix it.'
    : undefined

  // If org has a plausible BYOK key, use their chosen provider
  if (orgKey && provider) {
    return {
      provider,
      model: model || getDefaultModel(provider),
      apiKey: orgKey,
      label: `${provider} (BYOK)`,
    }
  }

  // If org chose openai but no key, check platform env
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: model || 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      label: 'OpenAI (platform)',
    }
  }

  // If org chose anthropic but no key, check platform env
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: model || 'claude-sonnet-4-20250514',
      apiKey: process.env.ANTHROPIC_API_KEY,
      label: 'Anthropic (platform)',
    }
  }

  // If org chose openrouter but no key, check platform env
  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      model: model || 'openrouter/free',
      apiKey: process.env.OPENROUTER_API_KEY,
      label: 'OpenRouter (platform)',
    }
  }

  // Free tier: OpenRouter (platform key) -> Groq (platform key) -> OpenAI (platform key) -> no provider
  // When falling back to a different provider than stored, force default model
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: openrouterKey,
      label: 'OpenRouter Free (auto-routing)',
      byokFailure,
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    const resolvedModel = (provider === 'groq' && model) ? model : 'llama-3.3-70b-versatile'
    return {
      provider: 'groq',
      model: resolvedModel,
      apiKey: groqKey,
      label: 'Groq Llama 3.3 (free)',
      byokFailure,
    }
  }

  // Last resort: check for any platform key
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    const resolvedModel = (provider === 'openai' && model) ? model : 'gpt-4o'
    return {
      provider: 'openai',
      model: resolvedModel,
      apiKey: openaiKey,
      label: 'OpenAI (platform fallback)',
      byokFailure,
    }
  }

  // No keys available at all
  return {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    apiKey: '',
    label: 'No AI provider configured',
  }
}

export function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile'
    case 'openai': return 'gpt-4o'
    case 'anthropic': return 'claude-sonnet-4-20250514'
    case 'openrouter': return 'openrouter/free'
  }
}

/**
 * Create a streaming chat completion using the resolved AI config.
 * Returns a ReadableStream of SSE events.
 */
export async function createChatStream(
  config: AIConfig,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()

  if (config.provider === 'groq') {
    return createGroqStream(config, messages, encoder)
  }

  if (config.provider === 'openai') {
    return createOpenAIStream(config, messages, encoder)
  }

  if (config.provider === 'anthropic') {
    return createAnthropicStream(config, messages, encoder)
  }

  if (config.provider === 'openrouter') {
    return createOpenRouterStream(config, messages, encoder)
  }

  throw new Error(`Unsupported provider: ${config.provider}`)
}

/** Prefix a BYOK-fallback notice onto a stream (SSE event the client renders as a banner). */
function withByokNotice(
  stream: ReadableStream<Uint8Array>,
  config: AIConfig,
  encoder: TextEncoder,
): ReadableStream<Uint8Array> {
  if (!config.byokFailure) return stream
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ notice: config.byokFailure })}\n\n`))
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
        controller.close()
      } catch (err) {
        try { controller.error(err) } catch { /* no-op */ }
      } finally {
        reader.releaseLock()
      }
    },
  })
}

async function createGroqStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const groq = new Groq({ apiKey: config.apiKey })

  const stream = await groq.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  const base = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = friendlyProviderError('groq', err, config.byokFailure)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
}

async function createOpenAIStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const openai = new OpenAI({ apiKey: config.apiKey })

  const stream = await openai.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  const base = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = friendlyProviderError('openai', err, config.byokFailure)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
}

async function createAnthropicStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.anthropic.com/v1/',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'x-api-key': config.apiKey,
    },
  })

  const stream = await client.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  const base = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = friendlyProviderError('anthropic', err, config.byokFailure)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
}

async function createOpenRouterStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.APP_BASE_URL || 'https://kingcrmhub.net',
      'X-Title': 'King CRM Hub',
    },
  })

  const stream = await client.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  const base = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = friendlyProviderError('openrouter', err, config.byokFailure)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
}
